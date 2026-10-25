import { prisma } from '@/lib/prisma';
import { NotificationType } from '@prisma/client';
import {
  CreateNotificationInput,
  NotificationItem,
  NotificationPreferences,
  NotificationQueryOptions,
  PaginatedNotifications,
  UpdatePreferencesInput,
} from './types';
import {
  createNotificationSchema,
  sanitizeMetadata,
  updatePreferencesSchema,
} from './validation';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/api-error';

/**
 * Checks if a given notification type is enabled by user preferences
 */
export function isCategoryEnabled(
  prefs: NotificationPreferences | null | undefined,
  type: NotificationType
): boolean {
  if (!prefs) return true;

  switch (type) {
    case 'TRIP_REMINDER':
    case 'TRIP_UPCOMING':
      return prefs.tripReminders;

    case 'ITINERARY_REMINDER':
    case 'ITINERARY_UPCOMING':
      return prefs.itineraryReminders;

    case 'TRANSPORT_REMINDER':
    case 'TRANSPORT_DEPARTURE':
    case 'TRANSPORT_ARRIVAL':
      return prefs.transportationReminders;

    case 'WEATHER_ALERT':
      return prefs.weatherAlerts;

    case 'BUDGET_ALERT':
      return prefs.budgetAlerts;

    case 'ACHIEVEMENT_UNLOCKED':
      return prefs.achievementAlerts;

    case 'SECURITY_ALERT':
    case 'SYSTEM':
      return prefs.securityAlerts;

    default:
      return true;
  }
}

/**
 * Retrieves or creates default notification preferences for an authenticated user
 */
export async function getUserPreferences(userId: string): Promise<NotificationPreferences> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const existing = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return prisma.notificationPreference.create({
    data: {
      userId,
      tripReminders: true,
      itineraryReminders: true,
      transportationReminders: true,
      weatherAlerts: true,
      budgetAlerts: true,
      achievementAlerts: true,
      securityAlerts: true,
      pushEnabled: false,
    },
  });
}

/**
 * Updates notification preferences for an authenticated user
 */
export async function updateUserPreferences(
  userId: string,
  input: UpdatePreferencesInput
): Promise<NotificationPreferences> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const validated = updatePreferencesSchema.parse(input);

  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      ...validated,
      updatedAt: new Date(),
    },
    create: {
      userId,
      tripReminders: validated.tripReminders ?? true,
      itineraryReminders: validated.itineraryReminders ?? true,
      transportationReminders: validated.transportationReminders ?? true,
      weatherAlerts: validated.weatherAlerts ?? true,
      budgetAlerts: validated.budgetAlerts ?? true,
      achievementAlerts: validated.achievementAlerts ?? true,
      securityAlerts: validated.securityAlerts ?? true,
      pushEnabled: validated.pushEnabled ?? false,
    },
  });
}

export interface CreateNotificationResult {
  created: boolean;
  duplicate?: boolean;
  reason?: string;
  notification?: NotificationItem | null;
}

/**
 * Centralized service to create a single notification with preference checking,
 * idempotency protection, and input sanitization.
 */
export async function createNotification(
  userId: string,
  rawInput: CreateNotificationInput
): Promise<CreateNotificationResult> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // 1. Strict validation
  const validated = createNotificationSchema.parse(rawInput);

  // 2. Check user notification preferences
  const prefs = await getUserPreferences(userId);
  if (!isCategoryEnabled(prefs, validated.type)) {
    return {
      created: false,
      reason: 'CATEGORY_DISABLED',
      notification: null,
    };
  }

  // 3. Sanitize metadata payload
  const sanitizedMeta = sanitizeMetadata(validated.data);
  const dataString = sanitizedMeta ? JSON.stringify(sanitizedMeta) : null;

  // 4. Handle idempotency / duplicate prevention
  if (validated.idempotencyKey) {
    const existing = await prisma.notification.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey: validated.idempotencyKey,
        },
      },
    });

    if (existing) {
      return {
        created: false,
        duplicate: true,
        notification: existing,
      };
    }
  }

  // 5. Database persistence
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: validated.type,
        title: validated.title,
        body: validated.body,
        actionUrl: validated.actionUrl ?? null,
        idempotencyKey: validated.idempotencyKey ?? null,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        data: dataString,
      },
    });

    // Dispatch Web Push to user's registered devices if push is enabled
    if (prefs?.pushEnabled) {
      try {
        const { sendPushToUser } = await import('@/lib/push/push-service');
        await sendPushToUser(userId, {
          title: notification.title,
          body: notification.body,
          actionUrl: notification.actionUrl || undefined,
          data: {
            id: notification.id,
            type: notification.type,
            data: sanitizedMeta,
          },
        });
      } catch (pushErr) {
        console.warn('[WebPush] Error dispatching push to user:', pushErr);
      }
    }

    return {
      created: true,
      notification,
    };
  } catch (error: unknown) {
    // Gracefully handle race-condition unique constraint collisions
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002' &&
      validated.idempotencyKey
    ) {
      const existing = await prisma.notification.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: validated.idempotencyKey,
          },
        },
      });
      return {
        created: false,
        duplicate: true,
        notification: existing,
      };
    }
    throw error;
  }
}

/**
 * Batch create multiple notifications
 */
export async function createNotifications(
  userId: string,
  inputs: CreateNotificationInput[]
): Promise<CreateNotificationResult[]> {
  const results: CreateNotificationResult[] = [];
  for (const input of inputs) {
    const res = await createNotification(userId, input);
    results.push(res);
  }
  return results;
}

/**
 * Returns paginated notifications for the authenticated user
 */
export async function getUserNotifications(
  userId: string,
  options: NotificationQueryOptions = {}
): Promise<PaginatedNotifications> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const whereClause: {
    userId: string;
    readAt?: null;
    type?: NotificationType;
  } = {
    userId,
    ...(options.unreadOnly ? { readAt: null } : {}),
    ...(options.type ? { type: options.type } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        body: true,
        data: true,
        actionUrl: true,
        idempotencyKey: true,
        expiresAt: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: whereClause,
    }),
    prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    }),
  ]);

  return {
    notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    unreadCount,
  };
}

/**
 * Get single notification with ownership verification
 */
export async function getNotificationById(
  userId: string,
  notificationId: string
): Promise<NotificationItem> {
  if (!userId || !notificationId) {
    throw new ValidationError('User ID and Notification ID are required');
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError('You do not have permission to view this notification');
  }

  return notification;
}

/**
 * Get unread count for user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<NotificationItem> {
  if (!userId || !notificationId) {
    throw new ValidationError('User ID and Notification ID are required');
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true, readAt: true },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError('You do not have permission to modify this notification');
  }

  if (notification.readAt) {
    return prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

/**
 * Mark all unread notifications as read for the user
 */
export async function markAllNotificationsRead(
  userId: string
): Promise<{ count: number }> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return { count: result.count };
}

/**
 * Delete a single notification with IDOR check
 */
export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<{ deleted: boolean }> {
  if (!userId || !notificationId) {
    throw new ValidationError('User ID and Notification ID are required');
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError('You do not have permission to delete this notification');
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return { deleted: true };
}

/**
 * Clear notifications (optionally only read ones)
 */
export async function clearNotifications(
  userId: string,
  options: { readOnly?: boolean } = {}
): Promise<{ count: number }> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const result = await prisma.notification.deleteMany({
    where: {
      userId,
      ...(options.readOnly ? { readAt: { not: null } } : {}),
    },
  });

  return { count: result.count };
}

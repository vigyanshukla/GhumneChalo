import { prisma } from '@/lib/prisma';
import { ReminderStatus, ReminderType, NotificationType } from '@prisma/client';
import {
  CreateReminderInput,
  ListRemindersQuery,
  ReminderItem,
  UpdateReminderInput,
} from './types';
import {
  createReminderSchema,
  listRemindersSchema,
  updateReminderSchema,
} from './validation';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/api-error';
import { createNotification } from '@/lib/notifications/notification-service';

/**
 * Maps reminder type to Phase 11A notification type
 */
export function mapReminderTypeToNotificationType(type: ReminderType): NotificationType {
  switch (type) {
    case ReminderType.TRIP_START:
      return NotificationType.TRIP_REMINDER;
    case ReminderType.ITINERARY_ACTIVITY:
      return NotificationType.ITINERARY_REMINDER;
    case ReminderType.TRANSPORT_DEPARTURE:
      return NotificationType.TRANSPORT_DEPARTURE;
    case ReminderType.TRANSPORT_ARRIVAL:
      return NotificationType.TRANSPORT_ARRIVAL;
    case ReminderType.WEATHER_ALERT:
      return NotificationType.WEATHER_ALERT;
    case ReminderType.BUDGET_ALERT:
      return NotificationType.BUDGET_ALERT;
    case ReminderType.CUSTOM:
    default:
      return NotificationType.SYSTEM;
  }
}

/**
 * Creates a reminder with strict authentication, ownership checks, and idempotency
 */
export async function createReminder(
  userId: string,
  rawInput: CreateReminderInput
): Promise<ReminderItem> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const validated = createReminderSchema.parse(rawInput);

  // IDOR & Ownership validation for trip association
  if (validated.tripId) {
    const trip = await prisma.trip.findFirst({
      where: { id: validated.tripId, userId },
      select: { id: true, status: true },
    });
    if (!trip) {
      throw new ForbiddenError('Trip not found or unauthorized');
    }
  }

  // IDOR check for itinerary item
  if (validated.itineraryItemId) {
    const item = await prisma.itineraryItem.findFirst({
      where: {
        id: validated.itineraryItemId,
        itineraryDay: {
          trip: { userId },
        },
      },
      select: { id: true },
    });
    if (!item) {
      throw new ForbiddenError('Itinerary activity not found or unauthorized');
    }
  }

  // IDOR check for transportation
  if (validated.transportationId) {
    const transport = await prisma.transportation.findFirst({
      where: {
        id: validated.transportationId,
        trip: { userId },
      },
      select: { id: true },
    });
    if (!transport) {
      throw new ForbiddenError('Transportation not found or unauthorized');
    }
  }

  const metadataStr =
    typeof validated.metadata === 'object'
      ? JSON.stringify(validated.metadata)
      : validated.metadata || null;

  // Idempotency check
  if (validated.idempotencyKey) {
    const existing = await prisma.reminder.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey: validated.idempotencyKey,
        },
      },
      include: {
        trip: {
          select: { id: true, title: true, destinationName: true },
        },
      },
    });

    if (existing) {
      return existing;
    }
  }

  try {
    return await prisma.reminder.create({
      data: {
        userId,
        tripId: validated.tripId,
        itineraryItemId: validated.itineraryItemId,
        itineraryDayId: validated.itineraryDayId,
        transportationId: validated.transportationId,
        type: validated.type,
        title: validated.title,
        message: validated.message,
        scheduledAt: validated.scheduledAt,
        status: ReminderStatus.SCHEDULED,
        deliveryState: 'PENDING',
        metadata: metadataStr,
        idempotencyKey: validated.idempotencyKey,
      },
      include: {
        trip: {
          select: { id: true, title: true, destinationName: true },
        },
      },
    });
  } catch (error: unknown) {
    // If concurrent insert produced duplicate idempotencyKey
    if (
      validated.idempotencyKey &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.reminder.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: validated.idempotencyKey,
          },
        },
        include: {
          trip: {
            select: { id: true, title: true, destinationName: true },
          },
        },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

/**
 * Gets a reminder by ID enforcing strict user isolation
 */
export async function getReminder(
  userId: string,
  reminderId: string
): Promise<ReminderItem> {
  if (!userId || !reminderId) {
    throw new ValidationError('User ID and Reminder ID are required');
  }

  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: {
      trip: {
        select: { id: true, title: true, destinationName: true },
      },
    },
  });

  if (!reminder) {
    throw new NotFoundError('Reminder not found');
  }

  if (reminder.userId !== userId) {
    throw new ForbiddenError('Access denied: Reminder belongs to another user');
  }

  return reminder;
}

/**
 * Lists reminders for an authenticated user with pagination and filters
 */
export async function listReminders(
  userId: string,
  rawQuery: ListRemindersQuery = {}
): Promise<{ reminders: ReminderItem[]; total: number }> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const query = listRemindersSchema.parse(rawQuery);
  const where: Record<string, unknown> = { userId };

  if (query.tripId) {
    where.tripId = query.tripId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.upcoming) {
    where.status = ReminderStatus.SCHEDULED;
    where.scheduledAt = { gte: new Date() };
  }

  const [reminders, total] = await Promise.all([
    prisma.reminder.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: query.limit,
      skip: query.offset,
      include: {
        trip: {
          select: { id: true, title: true, destinationName: true },
        },
      },
    }),
    prisma.reminder.count({ where }),
  ]);

  return { reminders, total };
}

/**
 * Updates a reminder with ownership checks
 */
export async function updateReminder(
  userId: string,
  reminderId: string,
  rawInput: UpdateReminderInput
): Promise<ReminderItem> {
  const existing = await getReminder(userId, reminderId);

  if (existing.status === ReminderStatus.SENT) {
    throw new ValidationError('Cannot update a reminder that has already been sent');
  }

  const validated = updateReminderSchema.parse(rawInput);
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (validated.title !== undefined) updateData.title = validated.title;
  if (validated.message !== undefined) updateData.message = validated.message;
  if (validated.scheduledAt !== undefined) updateData.scheduledAt = validated.scheduledAt;
  if (validated.status !== undefined) updateData.status = validated.status;

  if (validated.metadata !== undefined) {
    updateData.metadata =
      typeof validated.metadata === 'object'
        ? JSON.stringify(validated.metadata)
        : validated.metadata;
  }

  return prisma.reminder.update({
    where: { id: reminderId },
    data: updateData,
    include: {
      trip: {
        select: { id: true, title: true, destinationName: true },
      },
    },
  });
}

/**
 * Cancels a scheduled reminder
 */
export async function cancelReminder(
  userId: string,
  reminderId: string
): Promise<ReminderItem> {
  const existing = await getReminder(userId, reminderId);

  if (existing.status === ReminderStatus.CANCELLED) {
    return existing;
  }

  return prisma.reminder.update({
    where: { id: reminderId },
    data: {
      status: ReminderStatus.CANCELLED,
      deliveryState: 'CANCELLED',
      updatedAt: new Date(),
    },
    include: {
      trip: {
        select: { id: true, title: true, destinationName: true },
      },
    },
  });
}

/**
 * Deletes a reminder with ownership check
 */
export async function deleteReminder(
  userId: string,
  reminderId: string
): Promise<boolean> {
  await getReminder(userId, reminderId);

  await prisma.reminder.delete({
    where: { id: reminderId },
  });

  return true;
}

/**
 * Marks a reminder as successfully sent
 */
export async function markSent(
  reminderId: string,
  notificationId?: string
): Promise<void> {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      status: ReminderStatus.SENT,
      deliveryState: 'DELIVERED',
      sentAt: new Date(),
      metadata: notificationId
        ? JSON.stringify({ notificationId })
        : undefined,
      updatedAt: new Date(),
    },
  });
}

/**
 * Marks a reminder as failed with error reason
 */
export async function markFailed(
  reminderId: string,
  reason: string
): Promise<void> {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      status: ReminderStatus.FAILED,
      deliveryState: 'FAILED',
      failedReason: reason.substring(0, 500),
      updatedAt: new Date(),
    },
  });
}

/**
 * Helper to calculate reminder schedules safely with timezone awareness
 */
export function calculateReminderSchedule(
  type: ReminderType,
  targetDate: Date,
  options?: { hoursBefore?: number; daysBefore?: number }
): Date {
  const scheduled = new Date(targetDate.getTime());

  if (options?.daysBefore) {
    scheduled.setDate(scheduled.getDate() - options.daysBefore);
  } else if (options?.hoursBefore) {
    scheduled.setHours(scheduled.getHours() - options.hoursBefore);
  } else {
    switch (type) {
      case ReminderType.TRIP_START:
        // Default 24 hours prior
        scheduled.setHours(scheduled.getHours() - 24);
        break;
      case ReminderType.ITINERARY_ACTIVITY:
        // 1 hour prior
        scheduled.setHours(scheduled.getHours() - 1);
        break;
      case ReminderType.TRANSPORT_DEPARTURE:
        // 2 hours prior
        scheduled.setHours(scheduled.getHours() - 2);
        break;
      case ReminderType.TRANSPORT_ARRIVAL:
        // 30 minutes prior
        scheduled.setMinutes(scheduled.getMinutes() - 30);
        break;
      case ReminderType.WEATHER_ALERT:
        // 12 hours prior
        scheduled.setHours(scheduled.getHours() - 12);
        break;
      default:
        break;
    }
  }

  return scheduled;
}

/**
 * Generates automated trip start reminders for a specific trip
 */
export async function generateTripReminders(
  userId: string,
  tripId: string
): Promise<ReminderItem[]> {
  const [trip, prefs] = await Promise.all([
    prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: {
        id: true,
        title: true,
        destinationName: true,
        startDate: true,
        status: true,
      },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId },
    }),
  ]);

  if (!trip) throw new NotFoundError('Trip not found');

  // Cancelled or archived trips do not produce reminders
  if (trip.status === 'ARCHIVED') {
    await prisma.reminder.updateMany({
      where: { tripId: trip.id, status: ReminderStatus.SCHEDULED },
      data: { status: ReminderStatus.CANCELLED, deliveryState: 'CANCELLED' },
    });
    return [];
  }

  if (prefs && !prefs.tripReminders) {
    return [];
  }

  const results: ReminderItem[] = [];
  const start = new Date(trip.startDate);

  // 1. 3 Days Before Reminder
  const schedule3d = calculateReminderSchedule(ReminderType.TRIP_START, start, { daysBefore: 3 });
  if (schedule3d > new Date()) {
    const rem = await createReminder(userId, {
      tripId: trip.id,
      type: ReminderType.TRIP_START,
      title: `Upcoming Trip: ${trip.title}`,
      message: `Your trip to ${trip.destinationName} starts in 3 days! Check your itinerary and pack your bags.`,
      scheduledAt: schedule3d,
      idempotencyKey: `rem-trip-3d-${trip.id}`,
    });
    results.push(rem);
  }

  // 2. 1 Day Before Reminder
  const schedule1d = calculateReminderSchedule(ReminderType.TRIP_START, start, { daysBefore: 1 });
  if (schedule1d > new Date()) {
    const rem = await createReminder(userId, {
      tripId: trip.id,
      type: ReminderType.TRIP_START,
      title: `Trip Starts Tomorrow: ${trip.title}`,
      message: `Tomorrow is the day! Pack your bags for ${trip.destinationName} and double check your reservations.`,
      scheduledAt: schedule1d,
      idempotencyKey: `rem-trip-1d-${trip.id}`,
    });
    results.push(rem);
  }

  return results;
}

/**
 * Generates automated itinerary activity reminders for a trip
 */
export async function generateItineraryReminders(
  userId: string,
  tripId: string
): Promise<ReminderItem[]> {
  const [trip, prefs] = await Promise.all([
    prisma.trip.findFirst({
      where: { id: tripId, userId },
      include: {
        itineraryDays: {
          include: {
            items: true,
          },
        },
      },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId },
    }),
  ]);

  if (!trip) throw new NotFoundError('Trip not found');
  if (trip.status === 'ARCHIVED') return [];
  if (prefs && !prefs.itineraryReminders) return [];

  const results: ReminderItem[] = [];
  const now = new Date();

  for (const day of trip.itineraryDays) {
    for (const item of day.items) {
      if (!item.startTime) continue;

      // Parse start time (HH:mm) onto the day's date
      const [hours, minutes] = item.startTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const activityDate = new Date(day.date);
      activityDate.setHours(hours, minutes, 0, 0);

      // Reminder 1 hour before activity
      const reminderTime = calculateReminderSchedule(ReminderType.ITINERARY_ACTIVITY, activityDate, {
        hoursBefore: 1,
      });

      if (reminderTime > now) {
        const rem = await createReminder(userId, {
          tripId: trip.id,
          itineraryItemId: item.id,
          itineraryDayId: day.id,
          type: ReminderType.ITINERARY_ACTIVITY,
          title: `Upcoming Activity: ${item.name}`,
          message: `Your scheduled visit to ${item.name} begins in 1 hour (${item.startTime}).`,
          scheduledAt: reminderTime,
          idempotencyKey: `rem-itin-${item.id}-1h`,
        });
        results.push(rem);
      }
    }
  }

  return results;
}

/**
 * Generates automated transportation departure reminders
 */
export async function generateTransportationReminders(
  userId: string,
  tripId: string
): Promise<ReminderItem[]> {
  const [trip, prefs] = await Promise.all([
    prisma.trip.findFirst({
      where: { id: tripId, userId },
      include: {
        transportation: true,
      },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId },
    }),
  ]);

  if (!trip) throw new NotFoundError('Trip not found');
  if (trip.status === 'ARCHIVED') return [];
  if (prefs && !prefs.transportationReminders) return [];

  const results: ReminderItem[] = [];
  const now = new Date();

  for (const transport of trip.transportation) {
    if (!transport.departureTime) continue;

    const depTime = new Date(transport.departureTime);
    const hoursBefore = transport.type === 'FLIGHT' ? 3 : 2;
    const reminderTime = calculateReminderSchedule(ReminderType.TRANSPORT_DEPARTURE, depTime, {
      hoursBefore,
    });

    if (reminderTime > now) {
      const typeLabel = transport.type.charAt(0) + transport.type.slice(1).toLowerCase();
      const rem = await createReminder(userId, {
        tripId: trip.id,
        transportationId: transport.id,
        type: ReminderType.TRANSPORT_DEPARTURE,
        title: `${typeLabel} Departure Approaching`,
        message: `Your ${typeLabel.toLowerCase()} from ${transport.origin} to ${transport.destination} departs in ${hoursBefore} hours.`,
        scheduledAt: reminderTime,
        idempotencyKey: `rem-trans-dep-${transport.id}`,
      });
      results.push(rem);
    }
  }

  return results;
}

/**
 * Generates weather-aware reminders from genuine available weather data
 */
export async function generateWeatherReminders(
  userId: string,
  tripId: string
): Promise<ReminderItem[]> {
  const [trip, prefs] = await Promise.all([
    prisma.trip.findFirst({
      where: { id: tripId, userId },
      include: {
        weatherSnapshots: true,
      },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId },
    }),
  ]);

  if (!trip) throw new NotFoundError('Trip not found');
  if (trip.status === 'ARCHIVED') return [];
  if (prefs && !prefs.weatherAlerts) return [];

  const results: ReminderItem[] = [];
  const now = new Date();

  for (const snapshot of trip.weatherSnapshots) {
    // Only genuine data: rain probability >= 60%
    if (
      snapshot.precipitationProbability !== null &&
      snapshot.precipitationProbability >= 60
    ) {
      const snapDate = new Date(snapshot.date);
      // Remind 12 hours before or day prior
      const reminderTime = calculateReminderSchedule(ReminderType.WEATHER_ALERT, snapDate, {
        hoursBefore: 12,
      });

      if (reminderTime > now) {
        const rem = await createReminder(userId, {
          tripId: trip.id,
          type: ReminderType.WEATHER_ALERT,
          title: `Rain Alert for ${trip.destinationName}`,
          message: `Heavy rain (${snapshot.precipitationProbability}% chance) expected on your trip. Consider indoor activities or pack rain gear.`,
          scheduledAt: reminderTime,
          idempotencyKey: `rem-weather-${snapshot.id}`,
        });
        results.push(rem);
      }
    }
  }

  return results;
}

export interface ProcessDueRemindersResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Processes all due reminders up to a bounded batch size,
 * dispatches notifications through Phase 11A service, and marks reminders sent/failed.
 */
export async function processDueReminders(options: {
  limit?: number;
  now?: Date;
} = {}): Promise<ProcessDueRemindersResult> {
  const limit = Math.min(options.limit || 50, 100);
  const now = options.now || new Date();

  // Find due reminders
  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: ReminderStatus.SCHEDULED,
      scheduledAt: { lte: now },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
  });

  const result: ProcessDueRemindersResult = {
    processed: dueReminders.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const reminder of dueReminders) {
    // Atomic state transition: SCHEDULED -> PROCESSING
    const claim = await prisma.reminder.updateMany({
      where: {
        id: reminder.id,
        status: ReminderStatus.SCHEDULED,
      },
      data: {
        status: ReminderStatus.PROCESSING,
        deliveryState: 'PROCESSING',
        updatedAt: new Date(),
      },
    });

    if (claim.count === 0) {
      // Handled by another concurrent worker
      result.skipped++;
      continue;
    }

    try {
      const notifType = mapReminderTypeToNotificationType(reminder.type);
      const deliveryKey = `rem-deliv-${reminder.id}`;

      // Dispatch to Phase 11A Notification Service
      const dispatchResult = await createNotification(reminder.userId, {
        type: notifType,
        title: reminder.title,
        body: reminder.message,
        data: reminder.metadata ? JSON.parse(reminder.metadata) : undefined,
        actionUrl: reminder.tripId ? `/trips/${reminder.tripId}` : '/reminders',
        idempotencyKey: deliveryKey,
      });

      if (dispatchResult.created || dispatchResult.duplicate) {
        await markSent(reminder.id, dispatchResult.notification?.id);
        result.sent++;
      } else {
        // Disallowed by user notification preferences
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: ReminderStatus.CANCELLED,
            deliveryState: 'SUPPRESSED_BY_PREFERENCES',
            updatedAt: new Date(),
          },
        });
        result.skipped++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown dispatch error';
      await markFailed(reminder.id, message);
      result.failed++;
    }
  }

  return result;
}

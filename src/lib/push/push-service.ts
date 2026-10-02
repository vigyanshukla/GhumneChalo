import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/api-error';

// Initialize VAPID details strictly from environment variables
const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  '';

const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

const vapidSubject =
  process.env.VAPID_SUBJECT || 'mailto:support@ghumnechalo.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.warn('[WebPush] Error configuring VAPID details:', err);
  }
}

export interface SaveSubscriptionInput {
  endpoint: string;
  p256dh?: string;
  auth?: string;
  fcmToken?: string | null;
  userAgent?: string | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

/**
 * Saves or updates a browser Web Push / FCM subscription in Supabase PostgreSQL
 */
export async function savePushSubscription(
  userId: string,
  input: SaveSubscriptionInput
) {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!input.endpoint || typeof input.endpoint !== 'string') {
    throw new ValidationError('Valid push subscription endpoint is required');
  }

  const p256dh = input.keys?.p256dh || input.p256dh || '';
  const auth = input.keys?.auth || input.auth || '';

  // Extract FCM registration token if endpoint is from fcm.googleapis.com
  let fcmToken = input.fcmToken || null;
  if (!fcmToken && input.endpoint.includes('fcm.googleapis.com/fcm/send/')) {
    fcmToken = input.endpoint.split('fcm.googleapis.com/fcm/send/')[1] || null;
  }

  // 1. Store/upsert push subscription in Supabase
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      userId,
      p256dh,
      auth,
      fcmToken,
      userAgent: input.userAgent || null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh,
      auth,
      fcmToken,
      userAgent: input.userAgent || null,
    },
  });

  // 2. Mark pushEnabled = true in notification preferences
  await prisma.notificationPreference.upsert({
    where: { userId },
    update: { pushEnabled: true },
    create: {
      userId,
      pushEnabled: true,
    },
  });

  return subscription;
}

/**
 * Removes a push subscription for the authenticated user
 */
export async function removePushSubscription(userId: string, endpoint: string) {
  if (!userId || !endpoint) {
    throw new ValidationError('User ID and endpoint are required');
  }

  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { id: true, userId: true },
  });

  if (!existing) {
    throw new NotFoundError('Subscription not found');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('You do not have permission to delete this subscription');
  }

  await prisma.pushSubscription.delete({
    where: { endpoint },
  });

  return { success: true };
}

/**
 * Gets all active push subscriptions for a user from Supabase
 */
export async function getUserPushSubscriptions(userId: string) {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  return prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Dispatches Web Push / FCM message to all active subscriptions of a user
 */
export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    actionUrl?: string;
    data?: unknown;
  }
) {
  if (!userId) return { sentCount: 0, failedCount: 0, removedCount: 0 };

  // Check if push is enabled in preferences
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (pref && !pref.pushEnabled) {
    return { sentCount: 0, failedCount: 0, removedCount: 0, reason: 'PUSH_DISABLED' };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sentCount: 0, failedCount: 0, removedCount: 0, reason: 'NO_SUBSCRIPTIONS' };
  }

  let sentCount = 0;
  let failedCount = 0;
  let removedCount = 0;

  const pushBody = JSON.stringify({
    title: payload.title,
    body: payload.body,
    actionUrl: payload.actionUrl || '/notifications',
    data: payload.data || {},
  });

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, pushBody);
      sentCount++;
    } catch (err: unknown) {
      failedCount++;
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : 0;

      // 404 Not Found or 410 Gone means the subscription is no longer active
      if (statusCode === 404 || statusCode === 410) {
        try {
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          });
          removedCount++;
        } catch {
          // ignore cleanup error
        }
      }
    }
  }

  return { sentCount, failedCount, removedCount };
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, TooManyRequestsError } from '@/lib/api-error';
import { createNotification } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push/push-service';
import { checkRateLimit } from '@/lib/auth-security';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Rate limiting: max 5 test pushes per 60 seconds (TC-11C.15)
    const rateLimit = checkRateLimit(`test_push:${user.id}`, 5, 60);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError(
        `Too many test push notifications. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`
      );
    }

    // 1. Create in-app notification in Supabase
    const inAppResult = await createNotification(user.id, {
      type: 'SYSTEM',
      title: '🔔 Test Notification',
      body: 'Your GhumneChalo notifications and Supabase push setup are working seamlessly!',
      actionUrl: '/notifications',
      data: {
        source: 'manual_test',
        timestamp: new Date().toISOString(),
      },
    });

    // 2. Dispatch push notification to registered browser / FCM subscriptions
    const pushResult = await sendPushToUser(user.id, {
      title: '🔔 Test Notification',
      body: 'Your GhumneChalo notifications and Supabase push setup are working seamlessly!',
      actionUrl: '/notifications',
      data: {
        notificationId: inAppResult.notification?.id,
      },
    });

    return apiSuccess({
      notification: inAppResult.notification,
      pushResult,
      message: 'Test notification created in Supabase and dispatched to devices.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

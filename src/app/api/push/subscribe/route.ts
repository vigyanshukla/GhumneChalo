import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError } from '@/lib/api-error';
import {
  savePushSubscription,
  removePushSubscription,
} from '@/lib/push/push-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    // Security: Never trust client-provided userId
    delete body.userId;

    if (!body.endpoint || typeof body.endpoint !== 'string') {
      throw new ValidationError('A valid push subscription endpoint is required');
    }

    const subscription = await savePushSubscription(user.id, body);
    return apiSuccess(subscription, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    if (!body.endpoint || typeof body.endpoint !== 'string') {
      throw new ValidationError('Endpoint is required to unsubscribe');
    }

    const result = await removePushSubscription(user.id, body.endpoint);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

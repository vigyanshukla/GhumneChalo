import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { savePushSubscription } from '@/lib/push/push-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const subscription = await savePushSubscription(user.id, body);
    return apiSuccess(subscription, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

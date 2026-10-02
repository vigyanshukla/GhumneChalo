import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { removePushSubscription } from '@/lib/push/push-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const result = await removePushSubscription(user.id, body.endpoint);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

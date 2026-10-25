import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { markAllNotificationsRead } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const result = await markAllNotificationsRead(user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

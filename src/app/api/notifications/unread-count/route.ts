import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { getUnreadCount } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const unreadCount = await getUnreadCount(user.id);
    return apiSuccess({ unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import {
  getUserNotifications,
  createNotification,
  clearNotifications,
  NotificationType,
} from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;

    const unreadOnly = searchParams.get('unread') === 'true';
    const typeParam = searchParams.get('type') as NotificationType | null;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;

    const result = await getUserNotifications(user.id, {
      unreadOnly,
      type: typeParam || undefined,
      page,
      limit,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    delete body.userId;
    const result = await createNotification(user.id, body);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;
    const readOnly = searchParams.get('readOnly') === 'true';

    const result = await clearNotifications(user.id, { readOnly });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import {
  getNotificationById,
  markNotificationRead,
  deleteNotification,
} from '@/lib/notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const notification = await getNotificationById(user.id, id);
    return apiSuccess(notification);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const updated = await markNotificationRead(user.id, id);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const result = await deleteNotification(user.id, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

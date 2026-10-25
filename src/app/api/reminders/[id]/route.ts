import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import {
  getReminder,
  updateReminder,
  deleteReminder,
  cancelReminder,
} from '@/lib/reminders/reminder-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const reminder = await getReminder(user.id, id);
    return apiSuccess(reminder);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const body = await request.json();
    delete body.userId;

    if (body.action === 'cancel') {
      const cancelled = await cancelReminder(user.id, id);
      return apiSuccess(cancelled);
    }

    const updated = await updateReminder(user.id, id, body);
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

    const success = await deleteReminder(user.id, id);
    return apiSuccess({ success, id });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import {
  createReminder,
  listReminders,
} from '@/lib/reminders/reminder-service';
import { ReminderStatus, ReminderType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;

    const tripId = searchParams.get('tripId') || undefined;
    const statusParam = searchParams.get('status') as ReminderStatus | null;
    const typeParam = searchParams.get('type') as ReminderType | null;
    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const result = await listReminders(user.id, {
      tripId,
      status: statusParam || undefined,
      type: typeParam || undefined,
      upcoming,
      limit,
      offset,
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

    // Security: Never trust client-provided userId
    delete body.userId;

    const reminder = await createReminder(user.id, body);
    return apiSuccess(reminder, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { idSchema } from '@/lib/validation';
import { regenerateDayRequestSchema, regenerateAiTripDay } from '@/lib/ai';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; dayNumber: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayNumber: dayNumStr } = await params;
    idSchema.parse(tripId);

    const dayNumber = parseInt(dayNumStr, 10);
    if (isNaN(dayNumber) || dayNumber < 1) {
      throw new Error('Invalid day number. Must be a positive integer.');
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body optional
    }

    const { instruction, preferences } = regenerateDayRequestSchema.parse(body);

    const refreshedDay = await regenerateAiTripDay(
      tripId,
      dayNumber,
      user.id,
      instruction,
      preferences
    );

    return apiSuccess(refreshedDay, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, itineraryDayCreateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { verifyTripOwnership, calculateDayDate } from '@/lib/itinerary-service';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const trip = await verifyTripOwnership(tripId, user.id);

    const body = await request.json().catch(() => ({}));
    const validated = itineraryDayCreateSchema.parse(body);

    const lastDay = await prisma.itineraryDay.findFirst({
      where: { tripId },
      orderBy: { dayNumber: 'desc' },
      select: { dayNumber: true },
    });
    const dayNumber = validated.dayNumber ?? ((lastDay?.dayNumber ?? 0) + 1);
    const date = validated.date ?? calculateDayDate(trip.startDate, dayNumber);
    const title = validated.title !== undefined ? validated.title : `Day ${dayNumber}`;

    const newDay = await prisma.itineraryDay.create({
      data: {
        tripId,
        dayNumber,
        date,
        title,
      },
      include: {
        items: true,
      },
    });

    return apiSuccess(newDay, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

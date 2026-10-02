import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, itineraryItemCreateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { verifyDayOwnership } from '@/lib/itinerary-service';
import { evaluateAchievements } from '@/lib/achievements';

interface RouteContext {
  params: Promise<{ tripId: string; dayId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);

    const day = await verifyDayOwnership(tripId, dayId, user.id);

    const body = await request.json();
    const validatedData = itineraryItemCreateSchema.parse(body);

    let itemOrder = validatedData.order;
    if (itemOrder === undefined) {
      const lastItem = await prisma.itineraryItem.findFirst({
        where: { itineraryDayId: day.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      itemOrder = lastItem ? lastItem.order + 1 : 0;
    }

    const newItem = await prisma.itineraryItem.create({
      data: {
        itineraryDayId: day.id,
        name: validatedData.name,
        placeId: validatedData.placeId,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        notes: validatedData.notes,
        order: itemOrder,
      },
    });

    try {
      await evaluateAchievements(user.id, { eventType: 'ITINERARY_UPDATED', tripId });
    } catch {
      // Non-blocking
    }

    return apiSuccess(newItem, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

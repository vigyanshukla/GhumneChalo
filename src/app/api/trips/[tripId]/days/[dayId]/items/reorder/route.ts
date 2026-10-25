import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, itineraryItemsReorderSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError } from '@/lib/api-error';
import { verifyDayOwnership } from '@/lib/itinerary-service';

interface RouteContext {
  params: Promise<{ tripId: string; dayId: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);

    const day = await verifyDayOwnership(tripId, dayId, user.id);

    const body = await request.json();
    const { itemIds } = itineraryItemsReorderSchema.parse(body);

    // Verify all items belong to this day
    const existingItems = await prisma.itineraryItem.findMany({
      where: {
        id: { in: itemIds },
        itineraryDayId: day.id,
      },
      select: { id: true },
    });

    if (existingItems.length !== itemIds.length) {
      throw new ValidationError('One or more item IDs do not belong to this itinerary day');
    }

    // Atomic transaction updating each item's order
    await prisma.$transaction(
      itemIds.map((id, index) =>
        prisma.itineraryItem.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    const updatedItems = await prisma.itineraryItem.findMany({
      where: { itineraryDayId: day.id },
      orderBy: { order: 'asc' },
    });

    return apiSuccess(updatedItems);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PUT(request, context);
}

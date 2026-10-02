import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, itineraryItemUpdateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { verifyItemOwnership } from '@/lib/itinerary-service';

interface RouteContext {
  params: Promise<{ tripId: string; dayId: string; itemId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId, itemId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);
    idSchema.parse(itemId);

    const item = await verifyItemOwnership(tripId, dayId, itemId, user.id);

    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId, itemId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);
    idSchema.parse(itemId);

    const item = await verifyItemOwnership(tripId, dayId, itemId, user.id);

    const body = await request.json();
    const validatedData = itineraryItemUpdateSchema.parse(body);

    const updatedItem = await prisma.itineraryItem.update({
      where: { id: item.id },
      data: validatedData,
    });

    return apiSuccess(updatedItem);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId, itemId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);
    idSchema.parse(itemId);

    const item = await verifyItemOwnership(tripId, dayId, itemId, user.id);

    await prisma.itineraryItem.delete({
      where: { id: item.id },
    });

    return apiSuccess({ message: 'Itinerary item deleted successfully', id: itemId });
  } catch (error) {
    return handleApiError(error);
  }
}

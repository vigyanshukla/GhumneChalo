import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, itineraryDayUpdateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { verifyDayOwnership } from '@/lib/itinerary-service';

interface RouteContext {
  params: Promise<{ tripId: string; dayId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);

    const day = await verifyDayOwnership(tripId, dayId, user.id);

    const fullDay = await prisma.itineraryDay.findUnique({
      where: { id: day.id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return apiSuccess(fullDay);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);

    const day = await verifyDayOwnership(tripId, dayId, user.id);

    const body = await request.json();
    const validatedData = itineraryDayUpdateSchema.parse(body);

    const updatedDay = await prisma.itineraryDay.update({
      where: { id: day.id },
      data: validatedData,
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return apiSuccess(updatedDay);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, dayId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(dayId);

    const day = await verifyDayOwnership(tripId, dayId, user.id);

    await prisma.itineraryDay.delete({
      where: { id: day.id },
    });

    return apiSuccess({ message: 'Itinerary day deleted successfully', id: dayId });
  } catch (error) {
    return handleApiError(error);
  }
}

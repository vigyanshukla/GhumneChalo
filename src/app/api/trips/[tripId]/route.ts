import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { tripUpdateSchema, idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';
import { syncDaysWithTripDates } from '@/lib/itinerary-service';
import { evaluateAchievements } from '@/lib/achievements';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        userId: true,
        title: true,
        destinationName: true,
        destinationPlaceId: true,
        latitude: true,
        longitude: true,
        startDate: true,
        endDate: true,
        totalBudget: true,
        currency: true,
        status: true,
        isFavorite: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        budget: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    if (trip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to view this trip');
    }

    return apiSuccess(trip);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, userId: true, startDate: true, endDate: true },
    });

    if (!existingTrip) {
      throw new NotFoundError('Trip not found');
    }

    if (existingTrip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to modify this trip');
    }

    const body = await request.json();
    const validatedData = tripUpdateSchema.parse(body);
    const { confirmShorten, ...tripUpdatePayload } = validatedData;

    // Synchronize itinerary days if trip dates are changed
    if (tripUpdatePayload.startDate || tripUpdatePayload.endDate) {
      const finalStart = tripUpdatePayload.startDate || existingTrip.startDate;
      const finalEnd = tripUpdatePayload.endDate || existingTrip.endDate;
      await syncDaysWithTripDates(tripId, finalStart, finalEnd, confirmShorten);
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: tripUpdatePayload,
    });

    if (tripUpdatePayload.status) {
      try {
        await evaluateAchievements(user.id, { eventType: 'TRIP_COMPLETED', tripId });
      } catch {
        // Non-blocking
      }
    }

    return apiSuccess(updatedTrip);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, userId: true },
    });

    if (!existingTrip) {
      throw new NotFoundError('Trip not found');
    }

    if (existingTrip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to delete this trip');
    }

    await prisma.trip.delete({
      where: { id: tripId },
    });

    return apiSuccess({ message: 'Trip deleted successfully', id: tripId });
  } catch (error) {
    return handleApiError(error);
  }
}

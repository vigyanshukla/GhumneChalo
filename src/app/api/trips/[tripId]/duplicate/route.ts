import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        itineraryDays: {
          include: { items: true },
        },
        budget: {
          include: { expenses: true },
        },
        transportation: true,
      },
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    if (trip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to duplicate this trip');
    }

    // Duplicate trip and associated structure
    const duplicatedTrip = await prisma.$transaction(async (tx) => {
      const newTrip = await tx.trip.create({
        data: {
          userId: user.id,
          title: `${trip.title} (Copy)`,
          destinationName: trip.destinationName,
          destinationPlaceId: trip.destinationPlaceId,
          latitude: trip.latitude,
          longitude: trip.longitude,
          startDate: trip.startDate,
          endDate: trip.endDate,
          totalBudget: trip.totalBudget,
          currency: trip.currency,
          status: 'DRAFT',
          isFavorite: false,
          isArchived: false,
        },
      });

      // Duplicate budget if present
      if (trip.budget) {
        await tx.budget.create({
          data: {
            tripId: newTrip.id,
            totalAmount: trip.budget.totalAmount,
            currency: trip.budget.currency,
          },
        });
      }

      // Duplicate itinerary days and items
      for (const day of trip.itineraryDays) {
        const newDay = await tx.itineraryDay.create({
          data: {
            tripId: newTrip.id,
            dayNumber: day.dayNumber,
            date: day.date,
            title: day.title,
          },
        });

        if (day.items.length > 0) {
          await tx.itineraryItem.createMany({
            data: day.items.map((item) => ({
              itineraryDayId: newDay.id,
              placeId: item.placeId,
              name: item.name,
              latitude: item.latitude,
              longitude: item.longitude,
              startTime: item.startTime,
              endTime: item.endTime,
              notes: item.notes,
              order: item.order,
            })),
          });
        }
      }

      // Duplicate transportation
      if (trip.transportation.length > 0) {
        await tx.transportation.createMany({
          data: trip.transportation.map((t) => ({
            tripId: newTrip.id,
            type: t.type,
            origin: t.origin,
            destination: t.destination,
            departureTime: t.departureTime,
            arrivalTime: t.arrivalTime,
            cost: t.cost,
            currency: t.currency,
            notes: t.notes,
          })),
        });
      }

      return newTrip;
    });

    return apiSuccess(duplicatedTrip, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

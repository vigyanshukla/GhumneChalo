import { prisma } from './prisma';
import { NotFoundError, ForbiddenError, ValidationError } from './api-error';

export function calculateDuration(startDate: Date | string, endDate: Date | string): number {
  const s = new Date(startDate);
  s.setHours(0, 0, 0, 0);
  const e = new Date(endDate);
  e.setHours(0, 0, 0, 0);
  const diffTime = e.getTime() - s.getTime();
  return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

export function calculateDayDate(startDate: Date | string, dayNumber: number): Date {
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (dayNumber - 1));
  return d;
}

export async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      userId: true,
      title: true,
      destinationName: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  if (trip.userId !== userId) {
    throw new ForbiddenError('You do not have permission to access this trip');
  }

  return trip;
}

export async function verifyDayOwnership(tripId: string, dayId: string, userId: string) {
  const day = await prisma.itineraryDay.findUnique({
    where: { id: dayId },
    select: {
      id: true,
      tripId: true,
      dayNumber: true,
      date: true,
      title: true,
      trip: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!day || day.tripId !== tripId) {
    throw new NotFoundError('Itinerary day not found for this trip');
  }

  if (day.trip.userId !== userId) {
    throw new ForbiddenError('You do not have permission to access this itinerary day');
  }

  return day;
}

export async function verifyItemOwnership(
  tripId: string,
  dayId: string,
  itemId: string,
  userId: string
) {
  const item = await prisma.itineraryItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      itineraryDayId: true,
      order: true,
      name: true,
      placeId: true,
      latitude: true,
      longitude: true,
      startTime: true,
      endTime: true,
      notes: true,
      itineraryDay: {
        select: {
          id: true,
          tripId: true,
          trip: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      },
    },
  });

  if (
    !item ||
    item.itineraryDayId !== dayId ||
    item.itineraryDay.tripId !== tripId
  ) {
    throw new NotFoundError('Itinerary item not found for this day');
  }

  if (item.itineraryDay.trip.userId !== userId) {
    throw new ForbiddenError('You do not have permission to access this itinerary item');
  }

  return item;
}

/**
 * Initializes default itinerary days (Day 1..Day N) for a trip if none exist.
 */
export async function getOrCreateItineraryDays(
  tripId: string,
  startDate: Date,
  endDate: Date
) {
  const existingDays = await prisma.itineraryDay.findMany({
    where: { tripId },
    orderBy: { dayNumber: 'asc' },
    include: {
      items: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (existingDays.length > 0) {
    return existingDays;
  }

  const duration = calculateDuration(startDate, endDate);
  const daysToCreate = Array.from({ length: duration }, (_, i) => {
    const dayNumber = i + 1;
    return {
      tripId,
      dayNumber,
      date: calculateDayDate(startDate, dayNumber),
      title: `Day ${dayNumber}`,
    };
  });

  await prisma.itineraryDay.createMany({
    data: daysToCreate,
  });

  return prisma.itineraryDay.findMany({
    where: { tripId },
    orderBy: { dayNumber: 'asc' },
    include: {
      items: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

/**
 * Synchronizes itinerary days when a trip's start or end date changes.
 * Prevents silent destruction of user items on shortening unless confirmed.
 */
export async function syncDaysWithTripDates(
  tripId: string,
  newStart: Date,
  newEnd: Date,
  confirmShorten = false
) {
  const newDuration = calculateDuration(newStart, newEnd);

  const existingDays = await prisma.itineraryDay.findMany({
    where: { tripId },
    orderBy: { dayNumber: 'asc' },
    include: {
      _count: {
        select: { items: true },
      },
    },
  });

  if (existingDays.length === 0) {
    // If no days existed yet, create all days
    const daysToCreate = Array.from({ length: newDuration }, (_, i) => {
      const dayNumber = i + 1;
      return {
        tripId,
        dayNumber,
        date: calculateDayDate(newStart, dayNumber),
        title: `Day ${dayNumber}`,
      };
    });
    await prisma.itineraryDay.createMany({ data: daysToCreate });
    return;
  }

  // If trip duration shortened
  if (newDuration < existingDays.length) {
    const excessDays = existingDays.filter((d) => d.dayNumber > newDuration);
    const daysWithItems = excessDays.filter((d) => d._count.items > 0);

    if (daysWithItems.length > 0 && !confirmShorten) {
      const dayNums = daysWithItems.map((d) => `Day ${d.dayNumber}`).join(', ');
      throw new ValidationError(
        `Shortening the trip from ${existingDays.length} to ${newDuration} days would remove planned activities on ${dayNums}. Please reschedule or remove these activities first, or confirm shortening with confirmShorten.`
      );
    }

    // Execute in transaction: delete excess days and update remaining days' dates
    await prisma.$transaction(async (tx) => {
      if (excessDays.length > 0) {
        await tx.itineraryDay.deleteMany({
          where: {
            tripId,
            dayNumber: { gt: newDuration },
          },
        });
      }

      for (let i = 1; i <= newDuration; i++) {
        await tx.itineraryDay.updateMany({
          where: { tripId, dayNumber: i },
          data: {
            date: calculateDayDate(newStart, i),
          },
        });
      }
    });
    return;
  }

  // If trip duration increased or stayed same
  await prisma.$transaction(async (tx) => {
    // Update dates of existing days to align with new start date
    for (const day of existingDays) {
      await tx.itineraryDay.update({
        where: { id: day.id },
        data: {
          date: calculateDayDate(newStart, day.dayNumber),
        },
      });
    }

    // If new duration is greater, append additional days
    if (newDuration > existingDays.length) {
      const additionalDays = [];
      for (let i = existingDays.length + 1; i <= newDuration; i++) {
        additionalDays.push({
          tripId,
          dayNumber: i,
          date: calculateDayDate(newStart, i),
          title: `Day ${i}`,
        });
      }
      await tx.itineraryDay.createMany({
        data: additionalDays,
      });
    }
  });
}

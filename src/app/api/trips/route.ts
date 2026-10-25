import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { tripCreateSchema, paginationSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { calculateDuration, calculateDayDate } from '@/lib/itinerary-service';
import { evaluateAchievements } from '@/lib/achievements';
import { TripStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;

    const page = paginationSchema.shape.page.parse(searchParams.get('page') || undefined);
    const limit = paginationSchema.shape.limit.parse(searchParams.get('limit') || undefined);
    const statusParam = searchParams.get('status');
    const isFavoriteParam = searchParams.get('favorite');

    const status = statusParam && Object.values(TripStatus).includes(statusParam as TripStatus)
      ? (statusParam as TripStatus)
      : undefined;

    const isFavorite = isFavoriteParam !== null ? isFavoriteParam === 'true' : undefined;
    const sortParam = searchParams.get('sort');

    const where = {
      userId: user.id,
      ...(status ? { status } : {}),
      ...(isFavorite !== undefined ? { isFavorite } : {}),
      isArchived: false,
    };

    const orderBy =
      sortParam === 'startDate'
        ? { startDate: 'asc' as const }
        : sortParam === 'createdAt'
        ? { createdAt: 'desc' as const }
        : { updatedAt: 'desc' as const };

    const trips = await prisma.trip.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
        select: {
          id: true,
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
          _count: {
            select: {
              itineraryDays: true,
            },
          },
        },
    });

    const total =
      trips.length < limit && page === 1
        ? trips.length
        : await prisma.trip.count({ where });

    return apiSuccess(trips, 200, {
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return handleApiError(new Error('Invalid JSON in request body.'));
    }

    // userId in body is purposefully ignored / stripped by Zod parse
    const validatedData = tripCreateSchema.parse(body);

    // Prevent duplicate records from rapid double submission (within 15 seconds)
    const recentDuplicate = await prisma.trip.findFirst({
      where: {
        userId: user.id,
        title: validatedData.title,
        destinationName: validatedData.destinationName,
        createdAt: {
          gte: new Date(Date.now() - 15000),
        },
      },
    });

    if (recentDuplicate) {
      return apiSuccess(recentDuplicate, 200);
    }

    const duration = calculateDuration(validatedData.startDate, validatedData.endDate);
    const daysData = Array.from({ length: duration }, (_, i) => ({
      dayNumber: i + 1,
      date: calculateDayDate(validatedData.startDate, i + 1),
      title: `Day ${i + 1}`,
    }));

    const trip = await prisma.trip.create({
      data: {
        userId: user.id,
        title: validatedData.title,
        destinationName: validatedData.destinationName,
        destinationPlaceId: validatedData.destinationPlaceId,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        totalBudget: validatedData.totalBudget,
        currency: validatedData.currency,
        status: validatedData.status,
        itineraryDays: {
          create: daysData,
        },
        ...(validatedData.totalBudget !== undefined
          ? {
              budget: {
                create: {
                  totalAmount: validatedData.totalBudget,
                  currency: validatedData.currency,
                },
              },
            }
          : {}),
      },
      include: {
        budget: true,
        itineraryDays: {
          include: {
            items: true,
          },
        },
      },
    });

    try {
      await evaluateAchievements(user.id, { eventType: 'TRIP_CREATED', tripId: trip.id });
    } catch {
      // Non-blocking for trip creation
    }

    return apiSuccess(trip, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

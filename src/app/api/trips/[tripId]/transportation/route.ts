import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, transportationCreateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { evaluateAchievements } from '@/lib/achievements';
import {
  verifyTripOwnership,
  verifyItineraryDayOwnership,
  serializeTransportationNotes,
  normalizeTransportationRecord,
  tryComputeRoute,
} from '@/lib/transportation-service';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    await verifyTripOwnership(tripId, user.id);

    // Fetch transportation records and itinerary days concurrently
    const [records, itineraryDays] = await Promise.all([
      prisma.transportation.findMany({
        where: { tripId },
        orderBy: [{ departureTime: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.itineraryDay.findMany({
        where: { tripId },
        select: { id: true, dayNumber: true, title: true, date: true },
      }),
    ]);
    const daysMap = new Map(itineraryDays.map((d) => [d.id, d]));

    const normalized = records.map((r) => normalizeTransportationRecord(r, daysMap));

    return apiSuccess(normalized);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    await verifyTripOwnership(tripId, user.id);

    const body = await request.json().catch(() => ({}));
    const validatedData = transportationCreateSchema.parse(body);

    let associatedDay = null;
    if (validatedData.itineraryDayId) {
      associatedDay = await verifyItineraryDayOwnership(
        tripId,
        validatedData.itineraryDayId,
        user.id
      );
    }

    // Try computing route if coordinates are provided and distance is not yet calculated
    let distanceMeters = validatedData.distanceMeters ?? null;
    let durationSeconds = validatedData.durationSeconds ?? null;

    if (
      distanceMeters === null &&
      validatedData.originCoordinates &&
      validatedData.destinationCoordinates
    ) {
      const routeResult = await tryComputeRoute(
        validatedData.originCoordinates,
        validatedData.destinationCoordinates,
        validatedData.type
      );
      if (routeResult.distanceMeters !== null) {
        distanceMeters = routeResult.distanceMeters;
        durationSeconds = routeResult.durationSeconds;
      }
    }

    const serializedNotes = serializeTransportationNotes({
      notes: validatedData.notes,
      provider: validatedData.provider,
      bookingReference: validatedData.bookingReference,
      itineraryDayId: validatedData.itineraryDayId,
      originCoordinates: validatedData.originCoordinates,
      destinationCoordinates: validatedData.destinationCoordinates,
      distanceMeters,
      durationSeconds,
    });

    const newRecord = await prisma.transportation.create({
      data: {
        tripId,
        type: validatedData.type,
        origin: validatedData.origin,
        destination: validatedData.destination,
        departureTime: validatedData.departureTime,
        arrivalTime: validatedData.arrivalTime,
        cost: validatedData.cost,
        currency: validatedData.currency || 'INR',
        notes: serializedNotes,
      },
    });

    const daysMap = associatedDay
      ? new Map([[associatedDay.id, associatedDay]])
      : undefined;

    const normalized = normalizeTransportationRecord(newRecord, daysMap);

    try {
      await evaluateAchievements(user.id, { eventType: 'TRANSPORTATION_ADDED', tripId });
    } catch {
      // Non-blocking
    }

    return apiSuccess(normalized, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

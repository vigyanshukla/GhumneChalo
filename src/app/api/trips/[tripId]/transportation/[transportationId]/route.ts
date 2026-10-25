import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, transportationUpdateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import {
  verifyTransportationOwnership,
  verifyItineraryDayOwnership,
  deserializeTransportationNotes,
  serializeTransportationNotes,
  normalizeTransportationRecord,
  tryComputeRoute,
} from '@/lib/transportation-service';

interface RouteContext {
  params: Promise<{ tripId: string; transportationId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, transportationId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(transportationId);

    const record = await verifyTransportationOwnership(tripId, transportationId, user.id);

    // Fetch itinerary days for day resolution if attached
    const meta = deserializeTransportationNotes(record.notes);
    let daysMap: Map<string, { id: string; dayNumber: number; title: string | null; date: Date }> | undefined;
    if (meta.itineraryDayId) {
      const day = await prisma.itineraryDay.findUnique({
        where: { id: meta.itineraryDayId },
        select: { id: true, dayNumber: true, title: true, date: true },
      });
      if (day) daysMap = new Map([[day.id, day]]);
    }

    const normalized = normalizeTransportationRecord(record, daysMap);
    return apiSuccess(normalized);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, transportationId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(transportationId);

    const existingRecord = await verifyTransportationOwnership(
      tripId,
      transportationId,
      user.id
    );

    const body = await request.json();
    const validatedData = transportationUpdateSchema.parse(body);

    // Verify itinerary day ownership if changed
    if (validatedData.itineraryDayId) {
      await verifyItineraryDayOwnership(tripId, validatedData.itineraryDayId, user.id);
    }

    // Merge existing metadata with updates
    const currentMeta = deserializeTransportationNotes(existingRecord.notes);

    const mergedOriginCoords =
      validatedData.originCoordinates !== undefined
        ? validatedData.originCoordinates
        : currentMeta.originCoordinates;

    const mergedDestCoords =
      validatedData.destinationCoordinates !== undefined
        ? validatedData.destinationCoordinates
        : currentMeta.destinationCoordinates;

    let distanceMeters =
      validatedData.distanceMeters !== undefined
        ? validatedData.distanceMeters
        : currentMeta.distanceMeters;

    let durationSeconds =
      validatedData.durationSeconds !== undefined
        ? validatedData.durationSeconds
        : currentMeta.durationSeconds;

    // Recalculate route if coordinates changed and new distance wasn't explicitly supplied
    const coordsChanged =
      validatedData.originCoordinates !== undefined ||
      validatedData.destinationCoordinates !== undefined;

    if (coordsChanged && validatedData.distanceMeters === undefined) {
      const routeResult = await tryComputeRoute(
        mergedOriginCoords,
        mergedDestCoords,
        validatedData.type || existingRecord.type
      );
      if (routeResult.distanceMeters !== null) {
        distanceMeters = routeResult.distanceMeters;
        durationSeconds = routeResult.durationSeconds;
      }
    }

    const updatedNotesStr = serializeTransportationNotes({
      notes: validatedData.notes !== undefined ? validatedData.notes : currentMeta.notes,
      provider:
        validatedData.provider !== undefined ? validatedData.provider : currentMeta.provider,
      bookingReference:
        validatedData.bookingReference !== undefined
          ? validatedData.bookingReference
          : currentMeta.bookingReference,
      itineraryDayId:
        validatedData.itineraryDayId !== undefined
          ? validatedData.itineraryDayId
          : currentMeta.itineraryDayId,
      originCoordinates: mergedOriginCoords,
      destinationCoordinates: mergedDestCoords,
      distanceMeters,
      durationSeconds,
    });

    const updatedRecord = await prisma.transportation.update({
      where: { id: transportationId },
      data: {
        ...(validatedData.type ? { type: validatedData.type } : {}),
        ...(validatedData.origin ? { origin: validatedData.origin } : {}),
        ...(validatedData.destination ? { destination: validatedData.destination } : {}),
        ...(validatedData.departureTime !== undefined
          ? { departureTime: validatedData.departureTime }
          : {}),
        ...(validatedData.arrivalTime !== undefined
          ? { arrivalTime: validatedData.arrivalTime }
          : {}),
        ...(validatedData.cost !== undefined ? { cost: validatedData.cost } : {}),
        ...(validatedData.currency ? { currency: validatedData.currency } : {}),
        notes: updatedNotesStr,
      },
    });

    // Resolve itinerary day
    const updatedMeta = deserializeTransportationNotes(updatedRecord.notes);
    let daysMap: Map<string, { id: string; dayNumber: number; title: string | null; date: Date }> | undefined;
    if (updatedMeta.itineraryDayId) {
      const day = await prisma.itineraryDay.findUnique({
        where: { id: updatedMeta.itineraryDayId },
        select: { id: true, dayNumber: true, title: true, date: true },
      });
      if (day) daysMap = new Map([[day.id, day]]);
    }

    const normalized = normalizeTransportationRecord(updatedRecord, daysMap);
    return apiSuccess(normalized);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, transportationId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(transportationId);

    await verifyTransportationOwnership(tripId, transportationId, user.id);

    await prisma.transportation.delete({
      where: { id: transportationId },
    });

    return apiSuccess({
      message: 'Transportation deleted successfully',
      id: transportationId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

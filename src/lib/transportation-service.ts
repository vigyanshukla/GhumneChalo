import { prisma } from './prisma';
import { NotFoundError, ForbiddenError, ValidationError } from './api-error';
import { computeRoute, formatRouteDistance, formatRouteDuration, RouteCoordinate } from './maps/routes';
import { Transportation, TransportationType } from '@prisma/client';

export { formatRouteDistance, formatRouteDuration };

export interface TransportationMetadata {
  notes?: string | null;
  provider?: string | null;
  bookingReference?: string | null;
  itineraryDayId?: string | null;
  originCoordinates?: RouteCoordinate | null;
  destinationCoordinates?: RouteCoordinate | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
}

export interface NormalizedTransportation {
  id: string;
  tripId: string;
  type: TransportationType;
  origin: string;
  destination: string;
  departureTime: Date | null;
  arrivalTime: Date | null;
  cost: number | null;
  currency: string;
  notes: string | null;
  provider: string | null;
  bookingReference: string | null;
  itineraryDayId: string | null;
  itineraryDay?: {
    id: string;
    dayNumber: number;
    title: string | null;
    date: Date;
  } | null;
  originCoordinates?: RouteCoordinate | null;
  destinationCoordinates?: RouteCoordinate | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  formattedDistance: string | null;
  formattedDuration: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Packages extended fields into a structured JSON string for storage in the `notes` column.
 */
export function serializeTransportationNotes(meta: TransportationMetadata): string | null {
  const hasMeta =
    meta.provider ||
    meta.bookingReference ||
    meta.itineraryDayId ||
    meta.originCoordinates ||
    meta.destinationCoordinates ||
    typeof meta.distanceMeters === 'number' ||
    typeof meta.durationSeconds === 'number';

  if (!hasMeta) {
    return meta.notes ? meta.notes.trim() : null;
  }

  const payload = {
    _v: 1,
    notes: meta.notes ? meta.notes.trim() : null,
    provider: meta.provider ? meta.provider.trim() : null,
    bookingReference: meta.bookingReference ? meta.bookingReference.trim() : null,
    itineraryDayId: meta.itineraryDayId || null,
    originCoordinates: meta.originCoordinates || null,
    destinationCoordinates: meta.destinationCoordinates || null,
    distanceMeters: typeof meta.distanceMeters === 'number' ? meta.distanceMeters : null,
    durationSeconds: typeof meta.durationSeconds === 'number' ? meta.durationSeconds : null,
  };

  return JSON.stringify(payload);
}

/**
 * Parses the `notes` column into user notes and metadata.
 */
export function deserializeTransportationNotes(rawNotes?: string | null): TransportationMetadata {
  if (!rawNotes || typeof rawNotes !== 'string') {
    return { notes: null };
  }

  const trimmed = rawNotes.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return {
          notes: typeof parsed.notes === 'string' ? parsed.notes : null,
          provider: typeof parsed.provider === 'string' ? parsed.provider : null,
          bookingReference: typeof parsed.bookingReference === 'string' ? parsed.bookingReference : null,
          itineraryDayId: typeof parsed.itineraryDayId === 'string' ? parsed.itineraryDayId : null,
          originCoordinates: parsed.originCoordinates || null,
          destinationCoordinates: parsed.destinationCoordinates || null,
          distanceMeters: typeof parsed.distanceMeters === 'number' ? parsed.distanceMeters : null,
          durationSeconds: typeof parsed.durationSeconds === 'number' ? parsed.durationSeconds : null,
        };
      }
    } catch {
      // Fallback to plain string if JSON parse fails
    }
  }

  return { notes: trimmed };
}

/**
 * Normalizes a raw Prisma Transportation record into a rich client response.
 */
export function normalizeTransportationRecord(
  record: Transportation,
  itineraryDaysMap?: Map<string, { id: string; dayNumber: number; title: string | null; date: Date }>
): NormalizedTransportation {
  const meta = deserializeTransportationNotes(record.notes);
  const itineraryDay = meta.itineraryDayId && itineraryDaysMap
    ? itineraryDaysMap.get(meta.itineraryDayId) || null
    : null;

  return {
    id: record.id,
    tripId: record.tripId,
    type: record.type,
    origin: record.origin,
    destination: record.destination,
    departureTime: record.departureTime,
    arrivalTime: record.arrivalTime,
    cost: record.cost,
    currency: record.currency,
    notes: meta.notes ?? null,
    provider: meta.provider ?? null,
    bookingReference: meta.bookingReference ?? null,
    itineraryDayId: meta.itineraryDayId ?? null,
    itineraryDay: itineraryDay ?? null,
    originCoordinates: meta.originCoordinates ?? null,
    destinationCoordinates: meta.destinationCoordinates ?? null,
    distanceMeters: meta.distanceMeters ?? null,
    durationSeconds: meta.durationSeconds ?? null,
    formattedDistance: typeof meta.distanceMeters === 'number' ? formatRouteDistance(meta.distanceMeters) : null,
    formattedDuration: typeof meta.durationSeconds === 'number' ? formatRouteDuration(meta.durationSeconds) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Verifies that the trip exists and belongs to the authenticated user.
 */
export async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, userId: true, title: true },
  });

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  if (trip.userId !== userId) {
    throw new ForbiddenError('You do not have permission to access this trip');
  }

  return trip;
}

/**
 * Verifies that the transportation record exists, belongs to the trip, and trip belongs to the user.
 */
export async function verifyTransportationOwnership(
  tripId: string,
  transportationId: string,
  userId: string
) {
  const transportation = await prisma.transportation.findUnique({
    where: { id: transportationId },
    include: {
      trip: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!transportation || transportation.tripId !== tripId) {
    throw new NotFoundError('Transportation record not found for this trip');
  }

  if (transportation.trip.userId !== userId) {
    throw new ForbiddenError('You do not have permission to access this transportation record');
  }

  return transportation;
}

/**
 * Verifies that the itinerary day exists and belongs to the current trip and user.
 */
export async function verifyItineraryDayOwnership(
  tripId: string,
  itineraryDayId: string,
  userId: string
) {
  const day = await prisma.itineraryDay.findUnique({
    where: { id: itineraryDayId },
    include: {
      trip: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!day || day.tripId !== tripId) {
    throw new ValidationError('The specified itinerary day does not belong to this trip');
  }

  if (day.trip.userId !== userId) {
    throw new ForbiddenError('You do not have permission to attach transportation to another user\'s itinerary day');
  }

  return day;
}

/**
 * Attempts to compute route distance and duration using Phase 3D Routes service.
 * Handles failures safely without throwing errors.
 */
export async function tryComputeRoute(
  origin?: RouteCoordinate | null,
  destination?: RouteCoordinate | null,
  type?: TransportationType
): Promise<{ distanceMeters: number | null; durationSeconds: number | null }> {
  if (!origin || !destination) {
    return { distanceMeters: null, durationSeconds: null };
  }

  // Driving routes do not apply to flights or ferries directly
  const travelMode = type === 'BUS' ? 'TRANSIT' : 'DRIVE';

  try {
    const route = await computeRoute({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode,
    });

    return {
      distanceMeters: route.distanceMeters ?? null,
      durationSeconds: route.durationSeconds ?? null,
    };
  } catch {
    // Gracefully fallback on route failure
    return { distanceMeters: null, durationSeconds: null };
  }
}

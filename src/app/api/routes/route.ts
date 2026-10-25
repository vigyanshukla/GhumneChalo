import { NextRequest } from 'next/server';
import { computeRoute, SUPPORTED_TRAVEL_MODES, TravelMode } from '@/lib/maps/routes';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, BadRequestError, NotFoundError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new BadRequestError('Invalid JSON in request body.');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestError('Request body must be a valid JSON object.');
    }

    const payload = body as Record<string, unknown>;

    // 1. Origin validation
    if (!payload.origin || typeof payload.origin !== 'object') {
      throw new BadRequestError('Missing or invalid origin parameter.');
    }
    const origin = payload.origin as Record<string, unknown>;
    const originLat = Number(origin.lat);
    const originLng = Number(origin.lng);

    if (isNaN(originLat) || originLat < -90 || originLat > 90) {
      throw new BadRequestError('Invalid origin latitude. Must be between -90 and 90.');
    }
    if (isNaN(originLng) || originLng < -180 || originLng > 180) {
      throw new BadRequestError('Invalid origin longitude. Must be between -180 and 180.');
    }

    // 2. Destination validation
    if (!payload.destination || typeof payload.destination !== 'object') {
      throw new BadRequestError('Missing or invalid destination parameter.');
    }
    const destination = payload.destination as Record<string, unknown>;
    const destLat = Number(destination.lat);
    const destLng = Number(destination.lng);

    if (isNaN(destLat) || destLat < -90 || destLat > 90) {
      throw new BadRequestError('Invalid destination latitude. Must be between -90 and 90.');
    }
    if (isNaN(destLng) || destLng < -180 || destLng > 180) {
      throw new BadRequestError('Invalid destination longitude. Must be between -180 and 180.');
    }

    // 3. Travel mode validation
    let travelMode: TravelMode = 'DRIVE';
    if (payload.travelMode !== undefined && payload.travelMode !== null) {
      if (typeof payload.travelMode !== 'string') {
        throw new BadRequestError('Travel mode must be a string.');
      }
      const upperMode = payload.travelMode.toUpperCase() as TravelMode;
      if (!SUPPORTED_TRAVEL_MODES.includes(upperMode)) {
        throw new BadRequestError(
          `Unsupported travel mode "${payload.travelMode}". Supported modes: ${SUPPORTED_TRAVEL_MODES.join(', ')}`
        );
      }
      travelMode = upperMode;
    }

    try {
      const route = await computeRoute({
        origin: {
          lat: originLat,
          lng: originLng,
          name: typeof origin.name === 'string' ? origin.name.trim() : undefined,
        },
        destination: {
          lat: destLat,
          lng: destLng,
          name: typeof destination.name === 'string' ? destination.name.trim() : undefined,
        },
        travelMode,
      });

      return apiSuccess(route);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.startsWith('ROUTE_NOT_FOUND')) {
          throw new NotFoundError('No route found between the specified origin and destination.');
        }
        if (err.message.startsWith('INVALID_') || err.message.startsWith('UNSUPPORTED_')) {
          throw new BadRequestError(err.message);
        }
      }
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

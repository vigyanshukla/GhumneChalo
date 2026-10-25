/**
 * Google Routes API Service
 *
 * Server-only utility for querying Google Routes API (v2:computeRoutes).
 * Features:
 * - Strict coordinate and travel mode validation
 * - Normalized route and leg models
 * - Polyline decoding utility
 * - Bounded LRU+TTL in-memory caching to minimize billing & latency
 * - Strict server-side API key protection
 */

import { ServerLRUCache } from '@/lib/cache/server-lru-cache';

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT' | 'TWO_WHEELER';

export const SUPPORTED_TRAVEL_MODES: TravelMode[] = [
  'DRIVE',
  'WALK',
  'BICYCLE',
  'TRANSIT',
  'TWO_WHEELER',
];

export interface RouteCoordinate {
  lat: number;
  lng: number;
  name?: string;
}

export interface NormalizedRouteLeg {
  distanceMeters?: number;
  durationSeconds?: number;
  distanceText: string;
  durationText: string;
}

export interface NormalizedRoute {
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  polyline: string;
  description?: string;
  travelMode: TravelMode;
  legs?: NormalizedRouteLeg[];
  warnings?: string[];
}

export interface ComputeRouteParams {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  travelMode?: TravelMode;
}

/**
 * Formats duration in seconds to human-readable string (e.g. "24 min", "2 hr 15 min")
 */
export function formatRouteDuration(seconds: number): string {
  if (seconds < 60) {
    return '< 1 min';
  }
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Formats distance in meters to human-readable string (e.g. "850 m", "12.4 km")
 */
export function formatRouteDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Decodes an encoded polyline string into an array of coordinate objects.
 * Implements the standard Google Encoded Polyline Algorithm.
 */
export function decodePolyline(encoded: string): RouteCoordinate[] {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  const points: RouteCoordinate[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/** Max 100 routes cached; route geometry can be ~15 KB each ≈ 1.5 MB max */
const routeCache = new ServerLRUCache<string, NormalizedRoute>({
  maxSize: 100,
  ttlMs: 60 * 60 * 1000, // 60 minutes — routes between fixed points change rarely
  label: 'routes:compute',
});

const inFlightRoutes = new Map<string, Promise<NormalizedRoute>>();

export function _clearRouteCache(): void {
  routeCache.clear();
  inFlightRoutes.clear();
}

export function _getRouteCacheStats() {
  return routeCache.stats();
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('GOOGLE_MAPS_API_KEY_MISSING');
  }
  return key.trim();
}

function validateCoordinate(coord: RouteCoordinate, label: string): void {
  if (!coord || typeof coord !== 'object') {
    throw new Error(`INVALID_${label.toUpperCase()}: Coordinate object is required`);
  }
  if (typeof coord.lat !== 'number' || Number.isNaN(coord.lat) || coord.lat < -90 || coord.lat > 90) {
    throw new Error(`INVALID_LATITUDE: Latitude for ${label} must be between -90 and 90`);
  }
  if (typeof coord.lng !== 'number' || Number.isNaN(coord.lng) || coord.lng < -180 || coord.lng > 180) {
    throw new Error(`INVALID_LONGITUDE: Longitude for ${label} must be between -180 and 180`);
  }
}

/**
 * Computes a route between origin and destination using Google Routes API.
 */
export async function computeRoute(params: ComputeRouteParams): Promise<NormalizedRoute> {
  const { origin, destination, travelMode = 'DRIVE' } = params;

  // 1. Validate inputs
  validateCoordinate(origin, 'origin');
  validateCoordinate(destination, 'destination');

  if (!SUPPORTED_TRAVEL_MODES.includes(travelMode)) {
    throw new Error(`UNSUPPORTED_TRAVEL_MODE: Travel mode "${travelMode}" is not supported`);
  }

  // 2. Check in-memory bounded LRU cache
  const cacheKey = `route:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}:${travelMode}`;
  const cached = routeCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  if (inFlightRoutes.has(cacheKey)) {
    return inFlightRoutes.get(cacheKey)!;
  }

  // 3. Prepare Google Routes API request
  const apiKey = getApiKey();
  const endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  const routePromise = (async () => {
    try {
      const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.legs.distanceMeters,routes.legs.duration,routes.warnings',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorDetails: any = null;
    try {
      errorDetails = await response.json();
    } catch {
      // ignore JSON parse error
    }
    const message = errorDetails?.error?.message || `Google Routes API returned HTTP ${response.status}`;
    console.error('[Google Routes API Error]:', message);
    throw new Error(`ROUTES_API_ERROR: ${message}`);
  }

  interface GoogleRouteResponse {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: {
        encodedPolyline?: string;
      };
      description?: string;
      legs?: Array<{
        distanceMeters?: number;
        duration?: string;
      }>;
      warnings?: string[];
    }>;
  }

  const data = (await response.json()) as GoogleRouteResponse;

  if (!data.routes || data.routes.length === 0) {
    throw new Error('ROUTE_NOT_FOUND: No route found between the specified origin and destination.');
  }

  const primaryRoute = data.routes[0];
  const distanceMeters = primaryRoute.distanceMeters ?? 0;
  
  // Parse duration string formatted as e.g. "1234s"
  let durationSeconds = 0;
  if (primaryRoute.duration) {
    durationSeconds = parseInt(primaryRoute.duration.replace('s', ''), 10) || 0;
  }

  const polyline = primaryRoute.polyline?.encodedPolyline ?? '';

  const normalizedLegs: NormalizedRouteLeg[] = (primaryRoute.legs || []).map((leg) => {
    const legDistance = leg.distanceMeters ?? 0;
    const legDurationSec = leg.duration ? parseInt(leg.duration.replace('s', ''), 10) || 0 : 0;
    return {
      distanceMeters: legDistance,
      durationSeconds: legDurationSec,
      distanceText: formatRouteDistance(legDistance),
      durationText: formatRouteDuration(legDurationSec),
    };
  });

  const normalized: NormalizedRoute = {
    distanceMeters,
    durationSeconds,
    distanceText: formatRouteDistance(distanceMeters),
    durationText: formatRouteDuration(durationSeconds),
    polyline,
    description: primaryRoute.description,
    travelMode,
    legs: normalizedLegs.length > 0 ? normalizedLegs : undefined,
    warnings: primaryRoute.warnings,
  };

      // 4. Store in bounded LRU cache
      routeCache.set(cacheKey, normalized);
      return normalized;
    } finally {
      inFlightRoutes.delete(cacheKey);
    }
  })();

  inFlightRoutes.set(cacheKey, routePromise);
  return routePromise;
}

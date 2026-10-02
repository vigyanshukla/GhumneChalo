import { prisma } from '../prisma';
import { calculateDistanceKm, formatDistance } from '../maps/places';
import { NotFoundError } from '../api-error';
import {
  EmergencyCategory,
  EmergencyPlace,
  EmergencySearchResponse,
} from './types';
import { VERIFIED_EMERGENCY_CONTACTS } from './emergency-contacts';

export const EMERGENCY_TYPE_CONFIG: Record<
  EmergencyCategory,
  { label: string; googleTypes: string[]; iconName: string }
> = {
  police: {
    label: 'Police Stations',
    googleTypes: ['police'],
    iconName: 'Shield',
  },
  hospital: {
    label: 'Hospitals & Medical Centers',
    googleTypes: ['hospital'],
    iconName: 'Hospital',
  },
  pharmacy: {
    label: 'Pharmacies & Chemists',
    googleTypes: ['pharmacy', 'drugstore'],
    iconName: 'Pill',
  },
};

interface CacheEntry {
  data: EmergencyPlace[];
  expiresAt: number;
}

const emergencyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('GOOGLE_MAPS_API_KEY_MISSING');
  }
  return key.trim();
}

export interface EmergencySearchOptions {
  latitude: number;
  longitude: number;
  category: EmergencyCategory;
  radiusMeters?: number;
  limit?: number;
  tripId?: string;
  userId?: string;
}

interface GooglePlacesNearbyResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    types?: string[];
    rating?: number;
    userRatingCount?: number;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    regularOpeningHours?: {
      openNow?: boolean;
      weekdayDescriptions?: string[];
    };
  }>;
}

/**
 * Searches for nearby emergency services (Police, Hospitals, Pharmacies)
 * using Google Places API (New) with strict coordinate validation and normalized outputs.
 */
export async function searchNearbyEmergency(
  options: EmergencySearchOptions
): Promise<EmergencySearchResponse> {
  const {
    latitude,
    longitude,
    category,
    radiusMeters = 10000,
    limit = 15,
    tripId,
    userId,
  } = options;

  // 1. If tripId provided, enforce IDOR trip ownership check
  if (tripId) {
    if (!userId) {
      throw new NotFoundError('Trip not found or unauthorized');
    }
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: { id: true, destinationName: true, latitude: true, longitude: true },
    });
    if (!trip) {
      throw new NotFoundError('Trip not found or unauthorized');
    }
  }

  // 2. Coordinate validation
  if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('INVALID_LATITUDE');
  }
  if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('INVALID_LONGITUDE');
  }

  const cleanCategory = category.toLowerCase().trim() as EmergencyCategory;
  const config = EMERGENCY_TYPE_CONFIG[cleanCategory];
  if (!config) {
    throw new Error('INVALID_CATEGORY');
  }

  const boundedRadius = Math.min(Math.max(500, radiusMeters), 50000);
  const boundedLimit = Math.min(Math.max(1, limit), 20);

  // Cache key: rounded coordinates (~100m)
  const latRounded = Math.round(latitude * 1000) / 1000;
  const lngRounded = Math.round(longitude * 1000) / 1000;
  const cacheKey = `emergency::${cleanCategory}::${latRounded}::${lngRounded}::${boundedRadius}::${boundedLimit}`;

  const cached = emergencyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      category: cleanCategory,
      userLocation: { latitude, longitude },
      places: cached.data,
      isOfflineFallback: false,
      offlineHelplines: VERIFIED_EMERGENCY_CONTACTS,
      meta: {
        totalFound: cached.data.length,
        searchRadiusMeters: boundedRadius,
        queriedAt: new Date().toISOString(),
      },
    };
  }

  const apiKey = getApiKey();
  const endpoint = 'https://places.googleapis.com/v1/places:searchNearby';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.internationalPhoneNumber,places.regularOpeningHours',
    },
    body: JSON.stringify({
      includedTypes: config.googleTypes,
      maxResultCount: boundedLimit,
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: boundedRadius,
        },
      },
    }),
  });

  if (!response.ok) {
    let errorDetails: { error?: { message?: string } } | null = null;
    try {
      errorDetails = (await response.json()) as { error?: { message?: string } };
    } catch {
      // ignore
    }
    const message = errorDetails?.error?.message || `Google Places API returned HTTP ${response.status}`;
    console.error('[Emergency Places Error]:', message);
    throw new Error(`PLACES_API_ERROR: ${message}`);
  }

  const data = (await response.json()) as GooglePlacesNearbyResponse;
  const rawPlaces = data.places || [];

  const places: EmergencyPlace[] = rawPlaces
    .filter((p) => p.id && p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => {
      const pLat = p.location!.latitude;
      const pLng = p.location!.longitude;
      const distKm = calculateDistanceKm(latitude, longitude, pLat, pLng);

      const phone = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
      const openNow = p.regularOpeningHours?.openNow ?? null;

      // Direct Google Maps navigation link
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pLat},${pLng}&destination_place_id=${p.id}`;

      return {
        placeId: p.id,
        name: p.displayName?.text || p.formattedAddress || `${config.label} Location`,
        formattedAddress: p.formattedAddress || '',
        latitude: pLat,
        longitude: pLng,
        category: cleanCategory,
        primaryType: p.primaryType || config.googleTypes[0],
        types: p.types,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        distanceKm: distKm,
        distanceFormatted: formatDistance(distKm),
        phoneNumber: phone,
        openNow,
        directionsUrl,
      };
    })
    // Sort strictly by distance for emergency priority (closest first)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  emergencyCache.set(cacheKey, {
    data: places,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return {
    category: cleanCategory,
    userLocation: { latitude, longitude },
    places,
    isOfflineFallback: false,
    offlineHelplines: VERIFIED_EMERGENCY_CONTACTS,
    meta: {
      totalFound: places.length,
      searchRadiusMeters: boundedRadius,
      queriedAt: new Date().toISOString(),
    },
  };
}

/**
 * Returns static offline emergency fallback payload when live provider is unreachable.
 */
export function getOfflineEmergencyFallback(
  latitude: number,
  longitude: number,
  category: EmergencyCategory
): EmergencySearchResponse {
  return {
    category,
    userLocation: { latitude, longitude },
    places: [],
    isOfflineFallback: true,
    offlineHelplines: VERIFIED_EMERGENCY_CONTACTS,
    meta: {
      totalFound: 0,
      searchRadiusMeters: 0,
      queriedAt: new Date().toISOString(),
    },
  };
}

/**
 * Clears memory cache during unit testing
 */
export function _clearEmergencyCache(): void {
  emergencyCache.clear();
}

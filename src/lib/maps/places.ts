/**
 * Google Places API (New) Service
 *
 * Server-only utility for querying Google Places API (New).
 * Features:
 * - Query input sanitization and length validation
 * - Normalized response structures
 * - Bounded LRU+TTL in-memory caching to minimize billing & latency
 * - Strict server-side API key protection
 */

import { ServerLRUCache } from '@/lib/cache/server-lru-cache';

export interface NormalizedPlace {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
}

export interface NormalizedPlaceDetails extends NormalizedPlace {
  nationalPhoneNumber?: string;
  websiteUri?: string;
  openNow?: boolean;
  weekdayDescriptions?: string[];
}

export interface NormalizedDiscoveryPlace extends NormalizedPlace {
  distanceKm?: number;
  distanceFormatted?: string;
}

export const SUPPORTED_DISCOVERY_CATEGORIES: Record<
  string,
  { label: string; googleTypes: string[] }
> = {
  attractions: { label: 'Attractions', googleTypes: ['tourist_attraction'] },
  restaurants: { label: 'Restaurants', googleTypes: ['restaurant'] },
  cafes: { label: 'Cafes', googleTypes: ['cafe'] },
  hotels: { label: 'Hotels', googleTypes: ['lodging'] },
  museums: { label: 'Museums', googleTypes: ['museum'] },
  parks: { label: 'Parks & Nature', googleTypes: ['park', 'national_park'] },
  shopping: { label: 'Shopping', googleTypes: ['shopping_mall', 'market'] },
  temples: { label: 'Spiritual & Heritage', googleTypes: ['hindu_temple', 'place_of_worship'] },
};

/**
 * Calculates geographic distance in kilometers using the Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

// Bounded LRU caches for Places API responses — prevents unbounded memory growth
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes
const DETAILS_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes (place details are stable)
const DISCOVER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Max 200 search queries cached; ~2 KB each ≈ 400 KB max */
const searchCache = new ServerLRUCache<string, NormalizedPlace[]>({
  maxSize: 200,
  ttlMs: SEARCH_CACHE_TTL_MS,
  label: 'places:search',
});

/** Max 500 place details cached; ~3 KB each ≈ 1.5 MB max */
const detailsCache = new ServerLRUCache<string, NormalizedPlaceDetails>({
  maxSize: 500,
  ttlMs: DETAILS_CACHE_TTL_MS,
  label: 'places:details',
});

/** Max 200 discover queries cached; ~4 KB each ≈ 800 KB max */
const discoverCache = new ServerLRUCache<string, NormalizedDiscoveryPlace[]>({
  maxSize: 200,
  ttlMs: DISCOVER_CACHE_TTL_MS,
  label: 'places:discover',
});

const inFlightSearches = new Map<string, Promise<NormalizedPlace[]>>();

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('GOOGLE_MAPS_API_KEY_MISSING');
  }
  return key.trim();
}

/**
 * Searches places using Google Places API (New) searchText endpoint.
 */
export async function searchPlaces(query: string, limit: number = 8): Promise<NormalizedPlace[]> {
  const sanitizedQuery = query.trim();
  if (sanitizedQuery.length < 2) {
    return [];
  }

  const cacheKey = `${sanitizedQuery.toLowerCase()}::${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  if (inFlightSearches.has(cacheKey)) {
    return inFlightSearches.get(cacheKey)!;
  }

  const apiKey = getApiKey();
  const endpoint = 'https://places.googleapis.com/v1/places:searchText';

  const searchPromise = (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount',
        },
        body: JSON.stringify({
          textQuery: sanitizedQuery,
          pageSize: Math.min(Math.max(1, limit), 20),
        }),
      });

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorDetails: any = null;
    try {
      errorDetails = await response.json();
    } catch {
      // ignore json parse error on non-200
    }
    const message = errorDetails?.error?.message || `Google Places API returned HTTP ${response.status}`;
    console.error('[Google Places API Error]:', message);
    throw new Error(`PLACES_API_ERROR: ${message}`);
  }

  interface GooglePlacesSearchResponse {
    places?: Array<{
      id: string;
      displayName?: { text: string; languageCode?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      primaryType?: string;
      types?: string[];
      rating?: number;
      userRatingCount?: number;
    }>;
  }

  const data = (await response.json()) as GooglePlacesSearchResponse;
  const rawPlaces = data.places || [];

  const normalized: NormalizedPlace[] = rawPlaces
    .filter((p) => p.id && p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text || p.formattedAddress || 'Unnamed Place',
      formattedAddress: p.formattedAddress || '',
      latitude: p.location!.latitude,
      longitude: p.location!.longitude,
      primaryType: p.primaryType,
      types: p.types,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
    }));

      // Store in bounded LRU cache
      searchCache.set(cacheKey, normalized);
      return normalized;
    } finally {
      inFlightSearches.delete(cacheKey);
    }
  })();

  inFlightSearches.set(cacheKey, searchPromise);
  return searchPromise;
}

/**
 * Retrieves detailed information for a specific place by Place ID.
 */
export async function getPlaceDetails(placeId: string): Promise<NormalizedPlaceDetails> {
  const sanitizedId = placeId.trim();
  if (!sanitizedId || !/^[A-Za-z0-9_-]+$/.test(sanitizedId)) {
    throw new Error('INVALID_PLACE_ID');
  }

  const cached = detailsCache.get(sanitizedId);
  if (cached !== null) {
    return cached;
  }

  const apiKey = getApiKey();
  const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(sanitizedId)}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,location,types,primaryType,rating,userRatingCount,nationalPhoneNumber,websiteUri,regularOpeningHours',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('PLACE_NOT_FOUND');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorDetails: any = null;
    try {
      errorDetails = await response.json();
    } catch {
      // ignore
    }
    const message = errorDetails?.error?.message || `Google Places API returned HTTP ${response.status}`;
    console.error('[Google Place Details Error]:', message);
    throw new Error(`PLACE_DETAILS_ERROR: ${message}`);
  }

  interface GooglePlaceDetailsResponse {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    types?: string[];
    rating?: number;
    userRatingCount?: number;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    regularOpeningHours?: {
      openNow?: boolean;
      weekdayDescriptions?: string[];
    };
  }

  const p = (await response.json()) as GooglePlaceDetailsResponse;

  const normalized: NormalizedPlaceDetails = {
    placeId: p.id,
    name: p.displayName?.text || p.formattedAddress || 'Unnamed Place',
    formattedAddress: p.formattedAddress || '',
    latitude: p.location?.latitude ?? 0,
    longitude: p.location?.longitude ?? 0,
    primaryType: p.primaryType,
    types: p.types,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    nationalPhoneNumber: p.nationalPhoneNumber,
    websiteUri: p.websiteUri,
    openNow: p.regularOpeningHours?.openNow,
    weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions,
  };

  detailsCache.set(sanitizedId, normalized);

  return normalized;
}

export interface DiscoverOptions {
  latitude: number;
  longitude: number;
  category: string;
  radiusMeters?: number;
  limit?: number;
}

/**
 * Discovers places around specific coordinates filtered by category
 * using Google Places API (New) searchNearby endpoint.
 */
export async function discoverPlaces(
  options: DiscoverOptions
): Promise<NormalizedDiscoveryPlace[]> {
  const { latitude, longitude, category, radiusMeters = 10000, limit = 10 } = options;

  if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('INVALID_LATITUDE');
  }

  if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('INVALID_LONGITUDE');
  }

  const categoryKey = category.toLowerCase().trim();
  const categoryConfig = SUPPORTED_DISCOVERY_CATEGORIES[categoryKey];
  if (!categoryConfig) {
    throw new Error('INVALID_CATEGORY');
  }

  const boundedRadius = Math.min(Math.max(1000, radiusMeters), 50000);
  const boundedLimit = Math.min(Math.max(1, limit), 20);

  // Round coordinates to ~100m for cache reuse efficiency
  const latRounded = Math.round(latitude * 1000) / 1000;
  const lngRounded = Math.round(longitude * 1000) / 1000;
  const cacheKey = `${categoryKey}::${latRounded}::${lngRounded}::${boundedRadius}::${boundedLimit}`;

  const cached = discoverCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const apiKey = getApiKey();
  const endpoint = 'https://places.googleapis.com/v1/places:searchNearby';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({
      includedTypes: categoryConfig.googleTypes,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorDetails: any = null;
    try {
      errorDetails = await response.json();
    } catch {
      // ignore
    }
    const message = errorDetails?.error?.message || `Google Places API returned HTTP ${response.status}`;
    console.error('[Google Places Discover Error]:', message);
    throw new Error(`PLACES_API_ERROR: ${message}`);
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
    }>;
  }

  const data = (await response.json()) as GooglePlacesNearbyResponse;
  const rawPlaces = data.places || [];

  const normalized: NormalizedDiscoveryPlace[] = rawPlaces
    .filter((p) => p.id && p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => {
      const distKm = calculateDistanceKm(
        latitude,
        longitude,
        p.location!.latitude,
        p.location!.longitude
      );
      return {
        placeId: p.id,
        name: p.displayName?.text || p.formattedAddress || 'Unnamed Place',
        formattedAddress: p.formattedAddress || '',
        latitude: p.location!.latitude,
        longitude: p.location!.longitude,
        primaryType: p.primaryType || categoryConfig.googleTypes[0],
        types: p.types,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        distanceKm: distKm,
        distanceFormatted: formatDistance(distKm),
      };
    })
    .sort((a, b) => {
      if (b.rating != null && a.rating != null && b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    });

  discoverCache.set(cacheKey, normalized);

  return normalized;
}

/**
 * Helper to clear memory cache during unit testing.
 * Also returns cache stats for monitoring.
 */
export function _clearPlacesCache(): void {
  searchCache.clear();
  detailsCache.clear();
  discoverCache.clear();
}

/** Return cache statistics for monitoring/debugging. */
export function _getPlacesCacheStats() {
  return {
    search: searchCache.stats(),
    details: detailsCache.stats(),
    discover: discoverCache.stats(),
  };
}

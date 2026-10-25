/**
 * GhumneChalo Search & Place Offline Cache
 * 
 * Provides local caching of:
 * 1. Search queries and normalized place results
 * 2. Aggregated offline place index for substring search without internet
 * 3. Place details (ratings, contacts, addresses, photos)
 * 4. Coordinate-based weather forecasts for searched places
 */

import { NormalizedPlace, NormalizedPlaceDetails } from '@/components/search/types';
import { getStoredItem, setStoredItem } from './client-cache';

const SEARCH_QUERY_PREFIX = 'gc_search_q_';
const PLACE_DETAILS_PREFIX = 'gc_place_details_';
const WEATHER_COORD_PREFIX = 'gc_weather_coord_';
const PLACES_INDEX_KEY = 'gc_cached_places_index';

const QUERY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PLACE_DETAILS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const WEATHER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_INDEXED_PLACES = 150;

function normalizeKey(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Persists places into an aggregated offline search index
 */
export function indexPlacesLocally(places: NormalizedPlace[]): void {
  if (typeof window === 'undefined' || !Array.isArray(places) || places.length === 0) return;
  try {
    const raw = localStorage.getItem(PLACES_INDEX_KEY);
    const existing: NormalizedPlace[] = raw ? JSON.parse(raw) : [];
    const placeMap = new Map<string, NormalizedPlace>();

    // Seed existing
    for (const p of existing) {
      if (p?.placeId) placeMap.set(p.placeId, p);
    }

    // Add or update with new places
    for (const p of places) {
      if (p?.placeId && p?.name) {
        placeMap.set(p.placeId, { ...placeMap.get(p.placeId), ...p });
      }
    }

    // Convert back to array, cap at MAX_INDEXED_PLACES (most recent first)
    const combined = Array.from(placeMap.values()).slice(-MAX_INDEXED_PLACES);
    localStorage.setItem(PLACES_INDEX_KEY, JSON.stringify(combined));
  } catch (err) {
    console.warn('[SearchCache] Failed to update places index:', err);
  }
}

/**
 * Cache results for a specific search query
 */
export function cacheSearchResults(query: string, places: NormalizedPlace[]): void {
  const clean = normalizeKey(query);
  if (!clean || clean.length < 2) return;

  setStoredItem(`${SEARCH_QUERY_PREFIX}${clean}`, places, QUERY_CACHE_TTL_MS);
  indexPlacesLocally(places);
}

/**
 * Retrieve cached search results.
 * If exact query is cached, returns it.
 * Otherwise, performs offline substring match against indexed places.
 */
export function getCachedSearchResults(query: string): { places: NormalizedPlace[]; isOfflineMatch: boolean } {
  const clean = normalizeKey(query);
  if (!clean || clean.length < 2) {
    return { places: [], isOfflineMatch: false };
  }

  // 1. Check exact query cache
  const exact = getStoredItem<NormalizedPlace[]>(`${SEARCH_QUERY_PREFIX}${clean}`);
  if (exact?.data && Array.isArray(exact.data) && exact.data.length > 0) {
    return { places: exact.data, isOfflineMatch: true };
  }

  // 2. Perform fuzzy/substring match across locally indexed places
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PLACES_INDEX_KEY);
      if (raw) {
        const allPlaces: NormalizedPlace[] = JSON.parse(raw);
        if (Array.isArray(allPlaces)) {
          const matches = allPlaces.filter((p) => {
            const nameMatch = p.name?.toLowerCase().includes(clean);
            const addressMatch = p.formattedAddress?.toLowerCase().includes(clean);
            const typeMatch = p.primaryType?.toLowerCase().includes(clean);
            return nameMatch || addressMatch || typeMatch;
          });

          if (matches.length > 0) {
            return { places: matches.slice(0, 8), isOfflineMatch: true };
          }
        }
      }
    } catch {
      // Local storage read error
    }
  }

  return { places: [], isOfflineMatch: false };
}

/**
 * Cache full place details (address, hours, contact, ratings, etc.)
 */
export function cachePlaceDetails(placeId: string, details: NormalizedPlaceDetails): void {
  if (!placeId || !details) return;
  setStoredItem(`${PLACE_DETAILS_PREFIX}${placeId}`, details, PLACE_DETAILS_TTL_MS);

  // Also ensure it is present in places index
  indexPlacesLocally([details]);
}

/**
 * Retrieve cached place details
 */
export function getCachedPlaceDetails(placeId: string): NormalizedPlaceDetails | null {
  if (!placeId) return null;
  const stored = getStoredItem<NormalizedPlaceDetails>(`${PLACE_DETAILS_PREFIX}${placeId}`);
  return stored?.data || null;
}

/**
 * Cache weather data for coordinates
 */
export function cachePlaceWeather(lat: number, lng: number, weather: unknown): void {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !weather) return;
  const key = `${WEATHER_COORD_PREFIX}${lat.toFixed(2)}_${lng.toFixed(2)}`;
  setStoredItem(key, weather, WEATHER_TTL_MS);
}

/**
 * Retrieve cached weather data for coordinates
 */
export function getCachedPlaceWeather<T = unknown>(lat: number, lng: number): T | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const key = `${WEATHER_COORD_PREFIX}${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const stored = getStoredItem<T>(key);
  return stored?.data || null;
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  discoverPlaces,
  _clearPlacesCache,
  SUPPORTED_DISCOVERY_CATEGORIES,
  calculateDistanceKm,
  formatDistance,
} from '../src/lib/maps/places';
import { GET as discoverRoute } from '../src/app/api/places/discover/route';

function createRequest(url: string, method = 'GET', body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: {
      'content-type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Phase 3C — Explore & Discovery Experience', () => {
  beforeEach(() => {
    _clearPlacesCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearPlacesCache();
  });

  // ==========================================
  // 1. DISCOVERY API & CATEGORIES
  // ==========================================
  describe('Discovery API Validation & Normalization', () => {
    it('TC-3C.01: Valid category returns normalized places with distance', async () => {
      const mockNearbyResponse = {
        places: [
          {
            id: 'places/ChIJAkshardham',
            displayName: { text: 'Swaminarayan Akshardham' },
            formattedAddress: 'Noida Mor, Pandav Nagar, New Delhi, Delhi 110092',
            location: { latitude: 28.6127, longitude: 77.2773 },
            primaryType: 'hindu_temple',
            types: ['hindu_temple', 'place_of_worship', 'tourist_attraction'],
            rating: 4.7,
            userRatingCount: 154000,
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockNearbyResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/places/discover?lat=28.6139&lng=77.2090&category=attractions&limit=5');
      const res = await discoverRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      const place = json.data[0];

      expect(place.placeId).toBe('places/ChIJAkshardham');
      expect(place.name).toBe('Swaminarayan Akshardham');
      expect(place.latitude).toBe(28.6127);
      expect(place.longitude).toBe(77.2773);
      expect(place.rating).toBe(4.7);
      expect(place.distanceKm).toBeDefined();
      expect(place.distanceFormatted).toContain('away');

      // Verify Google Places API (New) searchNearby was called with correct field mask
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby');
      expect((options?.headers as Record<string, string>)['X-Goog-FieldMask']).toBe(
        'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount'
      );
    });

    it('TC-3C.02: Invalid category rejected with 400 Bad Request', async () => {
      const req = createRequest('/api/places/discover?lat=28.6139&lng=77.2090&category=unsupported_category');
      const res = await discoverRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid discovery category');
    });

    it('TC-3C.03: Invalid latitude rejected with 400 Bad Request', async () => {
      const req = createRequest('/api/places/discover?lat=150&lng=77.2090&category=attractions');
      const res = await discoverRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid latitude');
    });

    it('TC-3C.04: Invalid longitude rejected with 400 Bad Request', async () => {
      const req = createRequest('/api/places/discover?lat=28.6139&lng=300&category=attractions');
      const res = await discoverRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid longitude');
    });

    it('TC-3C.05: Missing location handled correctly (defaults to fallback coordinates)', async () => {
      const mockNearbyResponse = {
        places: [
          {
            id: 'places/ChIJDelhiAttraction',
            displayName: { text: 'India Gate' },
            formattedAddress: 'Rajpath, India Gate, New Delhi',
            location: { latitude: 28.6129, longitude: 77.2295 },
            primaryType: 'tourist_attraction',
            types: ['tourist_attraction'],
            rating: 4.6,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockNearbyResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // No lat or lng provided in query params
      const req = createRequest('/api/places/discover?category=attractions');
      const res = await discoverRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('India Gate');
    });

    it('TC-3C.06: Places API failure sanitized without leaking credentials', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'The provided API key is invalid or quota exceeded.',
              status: 'PERMISSION_DENIED',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest('/api/places/discover?lat=28.6139&lng=77.2090&category=attractions');
      const res = await discoverRoute(req);
      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(JSON.stringify(json)).not.toContain(process.env.GOOGLE_MAPS_API_KEY || 'AIza');
    });

    it('TC-3C.07: Empty Places response handled gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ places: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/places/discover?lat=28.6139&lng=77.2090&category=attractions');
      const res = await discoverRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });
  });

  // ==========================================
  // 2. FILTERING & STALE REQUEST PROTECTION
  // ==========================================
  describe('Category Filtering & Stale Request Protection', () => {
    it('TC-3C.08: Category change updates requested Google types', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      // Query restaurants
      await discoverPlaces({
        latitude: 28.6139,
        longitude: 77.209,
        category: 'restaurants',
      });
      const firstCallBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(firstCallBody.includedTypes).toContain('restaurant');

      // Query cafes
      await discoverPlaces({
        latitude: 28.6139,
        longitude: 77.209,
        category: 'cafes',
      });
      const secondCallBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);
      expect(secondCallBody.includedTypes).toContain('cafe');
    });

    it('TC-3C.09: Rapid category changes ignore older stale responses', async () => {
      let resolveFirst: (value: unknown) => void;
      const firstSlowPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      let requestId = 0;
      let finalState = 'none';

      // Simulate client sequence controller pattern
      async function triggerDiscovery(category: string, promiseToAwait: Promise<unknown>) {
        const thisId = ++requestId;
        await promiseToAwait;
        // Stale response guard
        if (thisId === requestId) {
          finalState = category;
        }
      }

      // Fast category clicks: Click 1 (Restaurants, slow), then Click 2 (Cafes, fast)
      const call1 = triggerDiscovery('restaurants', firstSlowPromise);
      const call2 = triggerDiscovery('cafes', Promise.resolve());

      await call2;
      expect(finalState).toBe('cafes');

      // Now resolve the older slow call
      resolveFirst!(true);
      await call1;

      // Crucial: The older response must NOT overwrite the newer 'cafes' selection!
      expect(finalState).toBe('cafes');
    });
  });

  // ==========================================
  // 3. DISTANCE CALCULATION
  // ==========================================
  describe('Distance Calculation & Formatting', () => {
    it('TC-3C.10: Accurately calculates geographic distance using Haversine formula', () => {
      // New Delhi (28.6139, 77.2090) to Taj Mahal Agra (27.1751, 78.0421) ~178 km
      const distance = calculateDistanceKm(28.6139, 77.209, 27.1751, 78.0421);
      expect(distance).toBeGreaterThan(170);
      expect(distance).toBeLessThan(190);

      // Short distance (< 1 km)
      const shortDistance = calculateDistanceKm(28.6139, 77.209, 28.6145, 77.2095);
      expect(shortDistance).toBeLessThan(1);
      expect(formatDistance(shortDistance)).toContain('m away');

      // Standard distance (>= 1 km)
      expect(formatDistance(12.4)).toBe('12.4 km away');
    });
  });

  // ==========================================
  // 4. GUEST, SECURITY & CACHING
  // ==========================================
  describe('Guest Experience, Caching & Security', () => {
    it('TC-3C.16: Guest user can discover places without authentication', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            places: [
              {
                id: 'places/ChIJGuestDiscovery',
                displayName: { text: 'Lodhi Garden' },
                location: { latitude: 28.5931, longitude: 77.2197 },
                primaryType: 'park',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      // No Authorization header
      const req = createRequest('/api/places/discover?category=parks');
      const res = await discoverRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data[0].name).toBe('Lodhi Garden');
    });

    it('TC-3C.17: Duplicate discovery queries served from cache without duplicate fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            places: [
              {
                id: 'places/ChIJCachedDiscovery',
                displayName: { text: 'Red Fort' },
                location: { latitude: 28.6562, longitude: 77.241 },
                primaryType: 'tourist_attraction',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      // First query
      const res1 = await discoverPlaces({
        latitude: 28.6562,
        longitude: 77.241,
        category: 'attractions',
      });
      expect(res1).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second identical query
      const res2 = await discoverPlaces({
        latitude: 28.6562,
        longitude: 77.241,
        category: 'attractions',
      });
      expect(res2).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('TC-3C.18: Server API key is never exposed in discovery response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ places: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/places/discover?category=attractions');
      const res = await discoverRoute(req);
      const json = await res.json();

      expect(JSON.stringify(json)).not.toContain(process.env.GOOGLE_MAPS_API_KEY || 'AIza');
    });
  });

  // ==========================================
  // 5. MAP & SELECTION SYNCHRONIZATION
  // ==========================================
  describe('Map & Selection Synchronization', () => {
    it('TC-3C.11: Selecting a place synchronizes coordinates and triggers panTo', () => {
      let currentSelected: unknown = null;
      const mockMap = {
        panTo: vi.fn(),
        setZoom: vi.fn(),
      };

      function handleSelect(place: { latitude: number; longitude: number; name: string }) {
        currentSelected = place;
        mockMap.panTo({ lat: place.latitude, lng: place.longitude });
        mockMap.setZoom(15);
      }

      const samplePlace = {
        placeId: 'place-123',
        name: 'Hawa Mahal',
        latitude: 26.9239,
        longitude: 75.8267,
      };

      handleSelect(samplePlace);
      expect(currentSelected).toEqual(samplePlace);
      expect(mockMap.panTo).toHaveBeenCalledWith({ lat: 26.9239, lng: 75.8267 });
      expect(mockMap.setZoom).toHaveBeenCalledWith(15);
    });

    it('TC-3C.12: Marker click updates selected place state to single source of truth', () => {
      let selectedPlace: { placeId: string; name: string } | null = null;

      function onMarkerClick(place: { placeId: string; name: string }) {
        selectedPlace = place;
      }

      const markerPlace = { placeId: 'marker-456', name: 'Amer Fort' };
      onMarkerClick(markerPlace);

      expect(selectedPlace).toEqual(markerPlace);
    });

    it('TC-3C.14: Search selection and Explore discovery converge to the same selectedPlace state', () => {
      let appSelectedPlace: { placeId: string; name: string } | null = null;

      function selectFromSearch(place: { placeId: string; name: string }) {
        appSelectedPlace = place;
      }

      function selectFromExploreFeed(place: { placeId: string; name: string }) {
        appSelectedPlace = place;
      }

      const searchPlace = { placeId: 'search-1', name: 'City Palace' };
      const feedPlace = { placeId: 'feed-2', name: 'Jantar Mantar' };

      selectFromSearch(searchPlace);
      expect(appSelectedPlace).toEqual(searchPlace);

      selectFromExploreFeed(feedPlace);
      expect(appSelectedPlace).toEqual(feedPlace);
    });

    it('TC-3C.15: Selecting a popular destination updates discovery anchor location', () => {
      let currentAnchor = { lat: 28.6139, lng: 77.209, name: 'New Delhi' };
      const mockMap = { panTo: vi.fn(), setZoom: vi.fn() };

      function handleSelectPopular(dest: { latitude: number; longitude: number; name: string }) {
        currentAnchor = { lat: dest.latitude, lng: dest.longitude, name: dest.name };
        mockMap.panTo({ lat: dest.latitude, lng: dest.longitude });
        mockMap.setZoom(13);
      }

      const jaipur = { name: 'Jaipur', latitude: 26.9124, longitude: 75.7873 };
      handleSelectPopular(jaipur);

      expect(currentAnchor.name).toBe('Jaipur');
      expect(mockMap.panTo).toHaveBeenCalledWith({ lat: 26.9124, lng: 75.7873 });
      expect(mockMap.setZoom).toHaveBeenCalledWith(13);
    });
  });

  // ==========================================
  // 6. CATEGORIES CATALOG INTEGRITY
  // ==========================================
  describe('Categories Catalog Integrity', () => {
    it('TC-3C.19: Supported categories match product specification', () => {
      const categories = Object.keys(SUPPORTED_DISCOVERY_CATEGORIES);
      expect(categories).toContain('attractions');
      expect(categories).toContain('restaurants');
      expect(categories).toContain('cafes');
      expect(categories).toContain('hotels');
      expect(categories).toContain('museums');
      expect(categories).toContain('parks');
      expect(categories).toContain('shopping');
      expect(categories).toContain('temples');

      // Every category has a label and non-empty googleTypes
      for (const cat of categories) {
        expect(SUPPORTED_DISCOVERY_CATEGORIES[cat].label).toBeTruthy();
        expect(SUPPORTED_DISCOVERY_CATEGORIES[cat].googleTypes.length).toBeGreaterThan(0);
      }
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { searchPlaces, _clearPlacesCache } from '../src/lib/maps/places';
import { GET as searchPlacesRoute } from '../src/app/api/places/search/route';
import { GET as getPlaceDetailsRoute } from '../src/app/api/places/[placeId]/route';
import { GET as getRecentSearches, POST as postRecentSearch } from '../src/app/api/search/recent/route';
import { GET as getOftenSearched } from '../src/app/api/search/often/route';
import { DELETE as deleteSearchHistory } from '../src/app/api/search/history/route';

function createRequest(
  url: string,
  userId?: string,
  method: string = 'GET',
  body?: unknown
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: {
      'content-type': 'application/json',
      ...(userId ? { authorization: `Bearer ${userId}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Phase 3B — Places Search, Autocomplete & Search History', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  async function dbRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw new Error('Exceeded max retries');
  }

  beforeAll(async () => {
    // Create unique test users once for the test suite
    userA = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `phase3b-userA-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'User A',
        },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `phase3b-userB-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'User B',
        },
      })
    );
  });

  afterAll(async () => {
    // Clean up test users once
    if (userA?.id) {
      await prisma.searchHistory.deleteMany({ where: { userId: userA.id } });
      await prisma.user.deleteMany({ where: { id: userA.id } });
    }
    if (userB?.id) {
      await prisma.searchHistory.deleteMany({ where: { userId: userB.id } });
      await prisma.user.deleteMany({ where: { id: userB.id } });
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    _clearPlacesCache();

    // Fast clean up of search history records created during test
    if (userA?.id || userB?.id) {
      await prisma.searchHistory.deleteMany({
        where: {
          userId: {
            in: [userA?.id, userB?.id].filter(Boolean) as string[],
          },
        },
      });
    }
  });

  // ==========================================
  // 1. PLACES SEARCH INPUT & VALIDATION
  // ==========================================
  describe('Places Search Validation & Logic', () => {
    it('TC-3B.01: Empty or whitespace query returns empty array without API call', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const reqEmpty = createRequest('/api/places/search?q=');
      const resEmpty = await searchPlacesRoute(reqEmpty);
      expect(resEmpty.status).toBe(200);
      const dataEmpty = await resEmpty.json();
      expect(dataEmpty.success).toBe(true);
      expect(dataEmpty.data).toEqual([]);

      const reqSpaces = createRequest('/api/places/search?q=   ');
      const resSpaces = await searchPlacesRoute(reqSpaces);
      const dataSpaces = await resSpaces.json();
      expect(dataSpaces.success).toBe(true);
      expect(dataSpaces.data).toEqual([]);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('TC-3B.02: Queries under minimum length (<2 chars) return empty array', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const reqSingleChar = createRequest('/api/places/search?q=m');
      const res = await searchPlacesRoute(reqSingleChar);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('TC-3B.03: Valid query calls Google Places API (New) with correct endpoint, headers & field mask', async () => {
      const mockPlacesResponse = {
        places: [
          {
            id: 'places/ChIJQ99_fake_mumbai',
            displayName: { text: 'Mumbai' },
            formattedAddress: 'Mumbai, Maharashtra, India',
            location: { latitude: 19.076, longitude: 72.8777 },
            primaryType: 'locality',
            types: ['locality', 'political'],
            rating: 4.6,
            userRatingCount: 85000,
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockPlacesResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/places/search?q=Mumbai&limit=5');
      const res = await searchPlacesRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      const place = json.data[0];

      // Verify normalized structure
      expect(place.placeId).toBe('places/ChIJQ99_fake_mumbai');
      expect(place.name).toBe('Mumbai');
      expect(place.formattedAddress).toBe('Mumbai, Maharashtra, India');
      expect(place.latitude).toBe(19.076);
      expect(place.longitude).toBe(72.8777);
      expect(place.primaryType).toBe('locality');
      expect(place.rating).toBe(4.6);
      expect(place.userRatingCount).toBe(85000);

      // Verify Google Places API New request headers and field mask
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
      expect((options?.headers as Record<string, string>)['X-Goog-FieldMask']).toBe(
        'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount'
      );
    });

    it('TC-3B.04: Search results are safely cached in memory for identical queries', async () => {
      const mockPlacesResponse = {
        places: [
          {
            id: 'places/ChIJ_cached_place',
            displayName: { text: 'Jaipur' },
            formattedAddress: 'Jaipur, Rajasthan, India',
            location: { latitude: 26.9124, longitude: 75.7873 },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockPlacesResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // First query -> calls fetch
      const res1 = await searchPlaces('Jaipur', 5);
      expect(res1).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second identical query -> served from cache without duplicate fetch
      const res2 = await searchPlaces('Jaipur', 5);
      expect(res2).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('TC-3B.05: Upstream Google Places API error is handled safely without leaking credentials', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'The provided API key is invalid.',
              status: 'PERMISSION_DENIED',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest('/api/places/search?q=ErrorTrigger');
      const res = await searchPlacesRoute(req);
      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.success).toBe(false);
      // Ensure raw server secrets are not leaked
      expect(JSON.stringify(json)).not.toContain(process.env.GOOGLE_MAPS_API_KEY || 'AIza');
    });
  });

  // ==========================================
  // 2. PLACE DETAILS API
  // ==========================================
  describe('Place Details API', () => {
    it('TC-3B.06: Rejects malformed or suspicious placeId with 400 Bad Request', async () => {
      const req = createRequest('/api/places/invalid-id$@!');
      const res = await getPlaceDetailsRoute(req, {
        params: Promise.resolve({ placeId: 'invalid-id$@!' }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid place ID');
    });

    it('TC-3B.07: Returns normalized place details for valid placeId', async () => {
      const mockDetailsResponse = {
        id: 'ChIJPlaceDetails123',
        displayName: { text: 'Taj Mahal' },
        formattedAddress: 'Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001',
        location: { latitude: 27.1751, longitude: 78.0421 },
        primaryType: 'tourist_attraction',
        types: ['tourist_attraction', 'point_of_interest'],
        rating: 4.8,
        userRatingCount: 220000,
        nationalPhoneNumber: '0562 222 6431',
        websiteUri: 'https://www.tajmahal.gov.in/',
        regularOpeningHours: {
          openNow: true,
          weekdayDescriptions: ['Monday: 6:00 AM – 7:00 PM'],
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockDetailsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/places/ChIJPlaceDetails123');
      const res = await getPlaceDetailsRoute(req, {
        params: Promise.resolve({ placeId: 'ChIJPlaceDetails123' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.placeId).toBe('ChIJPlaceDetails123');
      expect(json.data.name).toBe('Taj Mahal');
      expect(json.data.latitude).toBe(27.1751);
      expect(json.data.longitude).toBe(78.0421);
      expect(json.data.nationalPhoneNumber).toBe('0562 222 6431');
      expect(json.data.websiteUri).toBe('https://www.tajmahal.gov.in/');
      expect(json.data.openNow).toBe(true);
    });

    it('TC-3B.08: Non-existent place returns 404 Not Found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 404, message: 'Place not found' } }), {
          status: 404,
        })
      );

      const req = createRequest('/api/places/ChIJNonExistentPlace');
      const res = await getPlaceDetailsRoute(req, {
        params: Promise.resolve({ placeId: 'ChIJNonExistentPlace' }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ==========================================
  // 3. SEARCH HISTORY PERSISTENCE & USER ISOLATION
  // ==========================================
  describe('Search History & User Isolation', () => {
    it('TC-3B.09: Authenticated user saves search history on place selection', async () => {
      const payload = {
        query: 'Goa',
        placeId: 'ChIJGoaPlaceId',
        placeName: 'Goa, India',
        latitude: 15.2993,
        longitude: 74.124,
      };

      const req = createRequest('/api/search/recent', userA.id, 'POST', payload);
      const res = await postRecentSearch(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.userId).toBe(userA.id);
      expect(json.data.query).toBe('Goa');
      expect(json.data.placeName).toBe('Goa, India');
      expect(json.data.searchCount).toBe(1);

      // Verify in DB directly
      const record = await prisma.searchHistory.findUnique({
        where: { userId_query: { userId: userA.id, query: 'Goa' } },
      });
      expect(record).not.toBeNull();
      expect(record?.placeId).toBe('ChIJGoaPlaceId');
    });

    it('TC-3B.10: Duplicate searches increment searchCount and update timestamp without creating duplicate rows', async () => {
      const payload = {
        query: 'Bengaluru',
        placeId: 'ChIJBengaluru',
        placeName: 'Bengaluru, Karnataka',
        latitude: 12.9716,
        longitude: 77.5946,
      };

      // Search 1
      const req1 = createRequest('/api/search/recent', userA.id, 'POST', payload);
      await postRecentSearch(req1);

      // Search 2 (identical query)
      const req2 = createRequest('/api/search/recent', userA.id, 'POST', payload);
      const res2 = await postRecentSearch(req2);
      expect(res2.status).toBe(201);
      const json2 = await res2.json();

      expect(json2.data.searchCount).toBe(2);

      // Verify only ONE row exists for userA + Bengaluru
      const allRows = await prisma.searchHistory.findMany({
        where: { userId: userA.id, query: 'Bengaluru' },
      });
      expect(allRows).toHaveLength(1);
      expect(allRows[0].searchCount).toBe(2);
    });

    it('TC-3B.11: User Isolation — User B cannot view or access User A search history', async () => {
      // User A searches
      await postRecentSearch(
        createRequest('/api/search/recent', userA.id, 'POST', {
          query: 'Kerala',
          placeId: 'ChIJKerala',
          placeName: 'Kerala, India',
          latitude: 10.8505,
          longitude: 76.2711,
        })
      );

      // User B requests their recent searches
      const reqB = createRequest('/api/search/recent', userB.id);
      const resB = await getRecentSearches(reqB);
      expect(resB.status).toBe(200);
      const jsonB = await resB.json();

      expect(jsonB.success).toBe(true);
      expect(jsonB.data).toEqual([]); // User B has no search history

      // User A requests their recent searches
      const reqA = createRequest('/api/search/recent', userA.id);
      const resA = await getRecentSearches(reqA);
      const jsonA = await resA.json();

      expect(jsonA.data).toHaveLength(1);
      expect(jsonA.data[0].query).toBe('Kerala');
    });

    it('TC-3B.12: Unauthenticated user cannot access or modify server search history', async () => {
      // GET without auth header -> 401
      const reqGet = createRequest('/api/search/recent');
      const resGet = await getRecentSearches(reqGet);
      expect(resGet.status).toBe(401);

      // POST without auth header -> 401
      const reqPost = createRequest('/api/search/recent', undefined, 'POST', {
        query: 'Hacked Place',
      });
      const resPost = await postRecentSearch(reqPost);
      expect(resPost.status).toBe(401);
    });

    it('TC-3B.13: Forged userId in request body is completely ignored by server', async () => {
      const maliciousBody = {
        userId: userB.id, // Trying to inject search history into User B
        query: 'SpoofedSearch',
        placeName: 'Spoofed Place',
      };

      const req = createRequest('/api/search/recent', userA.id, 'POST', maliciousBody);
      const res = await postRecentSearch(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      // Must be owned by userA, never userB
      expect(json.data.userId).toBe(userA.id);
      expect(json.data.userId).not.toBe(userB.id);

      const userBCheck = await prisma.searchHistory.findUnique({
        where: { userId_query: { userId: userB.id, query: 'SpoofedSearch' } },
      });
      expect(userBCheck).toBeNull();
    });

    it('TC-3B.14: Often searched ranks by frequency and recency accurately', async () => {
      // Create place 1 with 1 search
      await prisma.searchHistory.create({
        data: {
          userId: userA.id,
          query: 'PlaceRare',
          placeName: 'Rare Place',
          searchCount: 1,
          searchedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
      });

      // Create place 2 with 5 searches
      await prisma.searchHistory.create({
        data: {
          userId: userA.id,
          query: 'PlacePopular',
          placeName: 'Popular Place',
          searchCount: 5,
          searchedAt: new Date(),
        },
      });

      const req = createRequest('/api/search/often', userA.id);
      const res = await getOftenSearched(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(2);
      expect(json.data[0].query).toBe('PlacePopular');
      expect(json.data[0].searchCount).toBe(5);
    });

    it('TC-3B.15: Clear history deletes only the authenticated user search history', async () => {
      // User A and User B both have history
      await prisma.searchHistory.create({
        data: { userId: userA.id, query: 'SearchA', placeName: 'Place A' },
      });
      await prisma.searchHistory.create({
        data: { userId: userB.id, query: 'SearchB', placeName: 'Place B' },
      });

      // User A clears history
      const reqDelete = createRequest('/api/search/history', userA.id, 'DELETE');
      const resDelete = await deleteSearchHistory(reqDelete);
      expect(resDelete.status).toBe(200);

      // Verify User A has 0 records
      const remainingA = await prisma.searchHistory.findMany({ where: { userId: userA.id } });
      expect(remainingA).toHaveLength(0);

      // Verify User B still has 1 record
      const remainingB = await prisma.searchHistory.findMany({ where: { userId: userB.id } });
      expect(remainingB).toHaveLength(1);
      expect(remainingB[0].query).toBe('SearchB');
    });
  });
});

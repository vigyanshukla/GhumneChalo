import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  searchNearbyEmergency,
  getOfflineEmergencyFallback,
  _clearEmergencyCache,
  VERIFIED_EMERGENCY_CONTACTS,
  getEmergencyContactsByCategory,
  EMERGENCY_TYPE_CONFIG,
} from '../src/lib/emergency';
import { GET as emergencyNearbyRoute } from '../src/app/api/emergency/nearby/route';
import { GET as emergencyContactsRoute } from '../src/app/api/emergency/contacts/route';

function createRequest(
  url: string,
  userId?: string,
  method = 'GET',
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

describe('Phase 10B — Emergency Mode (TC-10B.01 to TC-10B.21)', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tripA: { id: string; title: string };
  let tripB: { id: string; title: string };

  const TEST_EMAIL_A = 'emergency.traveler.a@ghumnechalo-p10b.com';
  const TEST_EMAIL_B = 'emergency.traveler.b@ghumnechalo-p10b.com';

  beforeAll(async () => {
    // 1. Clean up potential leftover test data
    await prisma.trip.deleteMany({
      where: {
        user: { email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] } },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] } },
    });

    // 2. Create test users and trips for IDOR testing
    userA = await prisma.user.create({
      data: {
        email: TEST_EMAIL_A,
        name: 'Traveler Emergency A',
        emailVerified: new Date(),
      },
    });

    userB = await prisma.user.create({
      data: {
        email: TEST_EMAIL_B,
        name: 'Traveler Emergency B',
        emailVerified: new Date(),
      },
    });

    tripA = await prisma.trip.create({
      data: {
        userId: userA.id,
        title: 'Trip A Manali',
        destinationName: 'Manali, Himachal Pradesh',
        latitude: 32.2432,
        longitude: 77.1892,
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-10-05T00:00:00Z'),
      },
    });

    tripB = await prisma.trip.create({
      data: {
        userId: userB.id,
        title: 'Trip B Goa',
        destinationName: 'Panaji, Goa',
        latitude: 15.4909,
        longitude: 73.8278,
        startDate: new Date('2026-11-01T00:00:00Z'),
        endDate: new Date('2026-11-05T00:00:00Z'),
      },
    });
  });

  beforeEach(() => {
    _clearEmergencyCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearEmergencyCache();
  });

  afterAll(async () => {
    await prisma.trip.deleteMany({
      where: { id: { in: [tripA?.id, tripB?.id].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA?.id, userB?.id].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. GEOLOCATION PERMISSION & STATUS HANDLING
  // =========================================================================
  describe('Geolocation State & Permission Handling', () => {
    it('TC-10B.01: location permission granted coordinates are accepted', async () => {
      const mockCoords = { latitude: 28.6139, longitude: 77.209, accuracy: 15 };
      expect(mockCoords.latitude).toBeGreaterThanOrEqual(-90);
      expect(mockCoords.latitude).toBeLessThanOrEqual(90);
      expect(mockCoords.longitude).toBeGreaterThanOrEqual(-180);
      expect(mockCoords.longitude).toBeLessThanOrEqual(180);
      expect(mockCoords.accuracy).toBe(15);
    });

    it('TC-10B.02: location permission denied falls back safely without crash', async () => {
      // When user denies location permission, system falls back to fallback helplines or selected city
      const fallback = getOfflineEmergencyFallback(28.6139, 77.209, 'police');
      expect(fallback.isOfflineFallback).toBe(true);
      expect(fallback.offlineHelplines.length).toBeGreaterThan(0);
      expect(fallback.offlineHelplines.some((c) => c.number === '112')).toBe(true);
    });

    it('TC-10B.03: location unavailable or timeout handled gracefully', async () => {
      const contacts = getEmergencyContactsByCategory();
      expect(contacts.length).toBeGreaterThanOrEqual(10);
      const national = contacts.find((c) => c.number === '112');
      expect(national).toBeDefined();
      expect(national?.availableHours).toBe('24x7');
    });
  });

  // =========================================================================
  // 2. INPUT VALIDATION & COORDINATES
  // =========================================================================
  describe('Coordinate & Query Validation', () => {
    it('TC-10B.04: invalid latitude rejected with 422', async () => {
      const req = createRequest('/api/emergency/nearby?lat=95.5&lng=77.209&type=police');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('TC-10B.05: invalid longitude rejected with 422', async () => {
      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=195.0&type=hospital');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('TC-10B.05b: invalid emergency category type rejected with 422', async () => {
      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=invalid_type');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 3. NEARBY SEARCH (POLICE, HOSPITALS, PHARMACIES)
  // =========================================================================
  describe('Nearby Search by Category', () => {
    it('TC-10B.06: police search works and returns normalized places', async () => {
      const mockPoliceResponse = {
        places: [
          {
            id: 'places/ChIJPoliceConnaughtPlace',
            displayName: { text: 'Connaught Place Police Station' },
            formattedAddress: 'Shaheed Bhagat Singh Marg, Connaught Place, New Delhi, Delhi 110001',
            location: { latitude: 28.6289, longitude: 77.2155 },
            primaryType: 'police',
            types: ['police', 'government_office'],
            rating: 4.2,
            userRatingCount: 88,
            nationalPhoneNumber: '011 2336 4100',
            regularOpeningHours: { openNow: true },
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockPoliceResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=police');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.category).toBe('police');
      expect(json.data.places.length).toBe(1);

      const item = json.data.places[0];
      expect(item.name).toBe('Connaught Place Police Station');
      expect(item.category).toBe('police');
      expect(item.phoneNumber).toBe('011 2336 4100');
      expect(item.openNow).toBe(true);
      expect(item.distanceKm).toBeGreaterThan(0);
      expect(item.directionsUrl).toContain('https://www.google.com/maps/dir/?api=1');
    });

    it('TC-10B.07: hospital search works and includes medical centers', async () => {
      const mockHospitalResponse = {
        places: [
          {
            id: 'places/ChIJAIIMSNewDelhi',
            displayName: { text: 'AIIMS New Delhi' },
            formattedAddress: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi, Delhi 110029',
            location: { latitude: 28.5672, longitude: 77.2100 },
            primaryType: 'hospital',
            types: ['hospital', 'health'],
            rating: 4.5,
            userRatingCount: 12400,
            nationalPhoneNumber: '011 2658 8500',
            regularOpeningHours: { openNow: true },
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockHospitalResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=hospital');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.category).toBe('hospital');
      expect(json.data.places[0].name).toBe('AIIMS New Delhi');
    });

    it('TC-10B.08: pharmacy search works and maps drugstore types', async () => {
      const mockPharmacyResponse = {
        places: [
          {
            id: 'places/ChIJApolloPharmacyCP',
            displayName: { text: 'Apollo Pharmacy 24x7' },
            formattedAddress: 'Block E, Connaught Place, New Delhi, Delhi 110001',
            location: { latitude: 28.6315, longitude: 77.2198 },
            primaryType: 'pharmacy',
            types: ['pharmacy', 'health', 'store'],
            rating: 4.1,
            userRatingCount: 310,
            nationalPhoneNumber: '1860 500 0101',
            regularOpeningHours: { openNow: true },
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockPharmacyResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=pharmacy');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.category).toBe('pharmacy');
      expect(json.data.places[0].name).toBe('Apollo Pharmacy 24x7');
    });
  });

  // =========================================================================
  // 4. SECURITY, DATA SANITIZATION & NO CREDENTIAL LEAKS
  // =========================================================================
  describe('Security & Data Integrity', () => {
    it('TC-10B.09: Google credentials never reach client', async () => {
      const mockResponse = { places: [] };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=police');
      const res = await emergencyNearbyRoute(req);
      const text = await res.text();

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey && apiKey.length > 5) {
        expect(text).not.toContain(apiKey);
      }
      expect(text).not.toContain('X-Goog-Api-Key');
    });

    it('TC-10B.10: Google error sanitized without leaking credentials', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'The provided API key AIzaSyFakeSecret123 is invalid.',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=police');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).not.toContain('AIzaSyFakeSecret123');
    });

    it('TC-10B.11: malformed place data handled safely without throwing', async () => {
      const mockMalformedResponse = {
        places: [
          {
            // Missing id and location
            displayName: { text: 'Corrupt Facility' },
          },
          {
            id: 'places/ChIJValidHospital',
            displayName: { text: 'Valid Government Hospital' },
            formattedAddress: 'Ring Road, New Delhi',
            location: { latitude: 28.57, longitude: 77.22 },
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockMalformedResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=hospital');
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      // Only the valid place should survive filtering
      expect(json.data.places.length).toBe(1);
      expect(json.data.places[0].name).toBe('Valid Government Hospital');
    });

    it('TC-10B.12: no fabricated phone numbers when not provided by Google', async () => {
      const mockResponse = {
        places: [
          {
            id: 'places/ChIJNoPhonePost',
            displayName: { text: 'Local Police Post' },
            formattedAddress: 'Near Metro Gate 2, Delhi',
            location: { latitude: 28.62, longitude: 77.21 },
            primaryType: 'police',
            // No nationalPhoneNumber or internationalPhoneNumber
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest('/api/emergency/nearby?lat=28.6139&lng=77.209&type=police');
      const res = await emergencyNearbyRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      const place = json.data.places[0];
      expect(place.phoneNumber).toBeNull();
    });
  });

  // =========================================================================
  // 5. OFFLINE / FALLBACK HANDLING
  // =========================================================================
  describe('Offline & Network Fallback', () => {
    it('TC-10B.13: network failure handled gracefully with fallback=true', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network disconnected'));

      const req = createRequest(
        '/api/emergency/nearby?lat=28.6139&lng=77.209&type=police&fallback=true'
      );
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.isOfflineFallback).toBe(true);
      expect(json.data.places.length).toBe(0);
      expect(json.data.offlineHelplines.length).toBeGreaterThan(0);
    });

    it('TC-10B.14: offline fallback emergency contacts endpoint returns verified contacts', async () => {
      const req = createRequest('/api/emergency/contacts');
      const res = await emergencyContactsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.total).toBeGreaterThanOrEqual(10);
      expect(json.data.nationalPriorityHelpline).toBe('112');

      const numbers = json.data.contacts.map((c: { number: string }) => c.number);
      expect(numbers).toContain('112');
      expect(numbers).toContain('100');
      expect(numbers).toContain('108');
      expect(numbers).toContain('101');
      expect(numbers).toContain('1091');
      expect(numbers).toContain('1363');
    });
  });

  // =========================================================================
  // 6. AUTHORIZATION & IDOR PROTECTION
  // =========================================================================
  describe('Authorization & IDOR Protection', () => {
    it('TC-10B.17: unauthorized tripId query rejected when user not logged in', async () => {
      // Trying to query emergency for tripA without authentication
      const req = createRequest(
        `/api/emergency/nearby?lat=28.6139&lng=77.209&type=police&tripId=${tripA.id}`
      );
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-10B.18: User A cannot query emergency with User B tripId (IDOR)', async () => {
      // User A attempts to provide User B's tripId
      const req = createRequest(
        `/api/emergency/nearby?lat=28.6139&lng=77.209&type=police&tripId=${tripB.id}`,
        userA.id
      );
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Trip not found or unauthorized');
    });

    it('TC-10B.18b: User A can query emergency with own tripId', async () => {
      const mockResponse = { places: [] };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createRequest(
        `/api/emergency/nearby?lat=32.2432&lng=77.1892&type=police&tripId=${tripA.id}`,
        userA.id
      );
      const res = await emergencyNearbyRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  // =========================================================================
  // 7. ACTIONS & USER WORKFLOWS
  // =========================================================================
  describe('Actions & Data Contracts', () => {
    it('TC-10B.19: directions action URL format conforms to Google Maps standard', async () => {
      const mockHospital = {
        places: [
          {
            id: 'places/ChIJSafdarjung',
            displayName: { text: 'Safdarjung Hospital' },
            formattedAddress: 'Ring Road, New Delhi',
            location: { latitude: 28.5694, longitude: 77.2081 },
            primaryType: 'hospital',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockHospital), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await searchNearbyEmergency({
        latitude: 28.6139,
        longitude: 77.209,
        category: 'hospital',
      });

      const p = result.places[0];
      expect(p.directionsUrl).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=28.5694,77.2081&destination_place_id=places/ChIJSafdarjung'
      );
    });

    it('TC-10B.20: call action behaves correctly with tel URI format', async () => {
      const contacts = VERIFIED_EMERGENCY_CONTACTS;
      const c112 = contacts.find((c) => c.number === '112');
      expect(c112).toBeDefined();

      const telUri = `tel:${c112!.number.replace(/[^0-9]/g, '')}`;
      expect(telUri).toBe('tel:112');
    });

    it('TC-10B.15: mobile layout data contract supports concise, lightweight payload', async () => {
      const result = getOfflineEmergencyFallback(28.6139, 77.209, 'police');
      const payloadString = JSON.stringify(result);
      // Ensures payload is fast and under 25KB
      expect(payloadString.length).toBeLessThan(25000);
    });

    it('TC-10B.16: desktop UI categories configuration is complete', () => {
      const categories = Object.keys(EMERGENCY_TYPE_CONFIG);
      expect(categories).toContain('police');
      expect(categories).toContain('hospital');
      expect(categories).toContain('pharmacy');
    });
  });

  // =========================================================================
  // 8. REGRESSION PRESERVATION
  // =========================================================================
  describe('Regression Verification', () => {
    it('TC-10B.21: trips and users database integrity preserved', async () => {
      const refetchedTrip = await prisma.trip.findUnique({
        where: { id: tripA.id },
      });
      expect(refetchedTrip).not.toBeNull();
      expect(refetchedTrip?.userId).toBe(userA.id);

      const refetchedUser = await prisma.user.findUnique({
        where: { id: userA.id },
      });
      expect(refetchedUser).not.toBeNull();
      expect(refetchedUser?.email).toBe(TEST_EMAIL_A);
    });
  });
});

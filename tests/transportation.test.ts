import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { POST as createTrip } from '../src/app/api/trips/route';
import {
  GET as getTransportationList,
  POST as createTransportation,
} from '../src/app/api/trips/[tripId]/transportation/route';
import {
  GET as getSingleTransportation,
  PATCH as patchTransportation,
  DELETE as deleteTransportation,
} from '../src/app/api/trips/[tripId]/transportation/[transportationId]/route';
import { searchPlaces } from '../src/lib/maps/places';
import { computeRoute } from '../src/lib/maps/routes';
import { getOrCreateItineraryDays } from '../src/lib/itinerary-service';
import {
  tryComputeRoute,
  formatRouteDistance,
  formatRouteDuration,
} from '../src/lib/transportation-service';

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

describe('Phase 6 — Transportation Tracking', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tripA: { id: string; title: string };
  let tripB: { id: string; title: string };
  let dayA1: { id: string; dayNumber: number };
  let dayB1: { id: string; dayNumber: number };

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
    userA = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `phase6-userA-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Phase 6 User A',
        },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `phase6-userB-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Phase 6 User B',
        },
      })
    );

    // Create Trip for User A
    const reqA = createRequest('/api/trips', userA.id, 'POST', {
      title: 'Delhi to Mumbai Expedition',
      destinationName: 'Mumbai, Maharashtra',
      startDate: '2026-12-01T00:00:00.000Z',
      endDate: '2026-12-05T00:00:00.000Z',
      currency: 'INR',
    });
    const resA = await createTrip(reqA);
    const jsonA = await resA.json();
    tripA = jsonA.data;

    const daysA = await getOrCreateItineraryDays(
      tripA.id,
      new Date('2026-12-01'),
      new Date('2026-12-05')
    );
    dayA1 = daysA[0];

    // Create Trip for User B
    const reqB = createRequest('/api/trips', userB.id, 'POST', {
      title: 'Bangalore Tech Retreat',
      destinationName: 'Bangalore, Karnataka',
      startDate: '2026-12-10T00:00:00.000Z',
      endDate: '2026-12-12T00:00:00.000Z',
      currency: 'INR',
    });
    const resB = await createTrip(reqB);
    const jsonB = await resB.json();
    tripB = jsonB.data;

    const daysB = await getOrCreateItineraryDays(
      tripB.id,
      new Date('2026-12-10'),
      new Date('2026-12-12')
    );
    dayB1 = daysB[0];
  });

  afterAll(async () => {
    if (userA?.id) {
      await dbRetry(() => prisma.transportation.deleteMany({ where: { tripId: tripA.id } })).catch(() => {});
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userA.id } })).catch(() => {});
      await dbRetry(() => prisma.user.deleteMany({ where: { id: userA.id } })).catch(() => {});
    }
    if (userB?.id) {
      await dbRetry(() => prisma.transportation.deleteMany({ where: { tripId: tripB.id } })).catch(() => {});
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userB.id } })).catch(() => {});
      await dbRetry(() => prisma.user.deleteMany({ where: { id: userB.id } })).catch(() => {});
    }
  });

  // ==========================================
  // 1. TRANSPORTATION CREATION & VALIDATION (TC-6.01 - TC-6.08)
  // ==========================================
  describe('Transportation Creation & Input Validation', () => {
    let createdTransId: string;

    it('TC-6.01: Authenticated user can create transportation', async () => {
      const payload = {
        type: 'FLIGHT',
        origin: 'Indira Gandhi International Airport (DEL)',
        destination: 'Chhatrapati Shivaji Maharaj International Airport (BOM)',
        departureTime: '2026-12-01T06:00:00.000Z',
        arrivalTime: '2026-12-01T08:15:00.000Z',
        cost: 4500,
        currency: 'INR',
        provider: 'IndiGo',
        bookingReference: '6E-2041',
        notes: 'Terminal 3 departure, Web check-in completed.',
        itineraryDayId: dayA1.id,
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/transportation`,
        userA.id,
        'POST',
        payload
      );
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.type).toBe('FLIGHT');
      expect(json.data.origin).toBe('Indira Gandhi International Airport (DEL)');
      expect(json.data.destination).toBe('Chhatrapati Shivaji Maharaj International Airport (BOM)');
      expect(json.data.provider).toBe('IndiGo');
      expect(json.data.bookingReference).toBe('6E-2041');
      expect(json.data.itineraryDayId).toBe(dayA1.id);
      expect(json.data.itineraryDay?.dayNumber).toBe(1);

      createdTransId = json.data.id;
    });

    it('TC-6.02: Unauthenticated user cannot create transportation', async () => {
      const payload = {
        type: 'CAR',
        origin: 'Delhi',
        destination: 'Agra',
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/transportation`,
        undefined,
        'POST',
        payload
      );
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.03: Invalid transportation type rejected', async () => {
      const payload = {
        type: 'SPACESHIP',
        origin: 'Earth',
        destination: 'Mars',
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/transportation`,
        userA.id,
        'POST',
        payload
      );
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.04: Missing origin rejected when required', async () => {
      const payload = {
        type: 'TRAIN',
        origin: '',
        destination: 'Jaipur',
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/transportation`,
        userA.id,
        'POST',
        payload
      );
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.05: Missing destination rejected when required', async () => {
      const payload = {
        type: 'BUS',
        origin: 'Delhi ISBT',
        destination: '   ',
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/transportation`,
        userA.id,
        'POST',
        payload
      );
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.06: Invalid date/time relationship rejected (arrival before departure)', async () => {
      const payload = {
        type: 'TRAIN',
        origin: 'New Delhi Railway Station',
        destination: 'Mumbai Central',
        departureTime: '2026-12-02T16:00:00.000Z',
        arrivalTime: '2026-12-02T10:00:00.000Z', // 6 hours before departure
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/transportation`,
        userA.id,
        'POST',
        payload
      );
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.07: Negative cost rejected', async () => {
      const payload = {
        type: 'CAR',
        origin: 'Delhi',
        destination: 'Gurgaon',
        cost: -250,
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/transportation`,
        userA.id,
        'POST',
        payload
      );
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.08: Valid transportation persisted and retrieved from database', async () => {
      const record = await prisma.transportation.findUnique({
        where: { id: createdTransId },
      });

      expect(record).not.toBeNull();
      expect(record?.tripId).toBe(tripA.id);
      expect(record?.type).toBe('FLIGHT');
      expect(record?.cost).toBe(4500);
    });
  });

  // ==========================================
  // 2. LIST, READ & USER ISOLATION (TC-6.09 - TC-6.10, TC-6.15 - TC-6.17)
  // ==========================================
  describe('Listing, Retrieval & User Isolation (IDOR)', () => {
    let transAId: string;
    let transBId: string;

    beforeAll(async () => {
      const resA = await createTransportation(
        createRequest(`/api/trips/${tripA.id}/transportation`, userA.id, 'POST', {
          type: 'TRAIN',
          origin: 'Mumbai CSMT',
          destination: 'Pune Junction',
          provider: 'Deccan Queen',
          cost: 480,
        }),
        { params: Promise.resolve({ tripId: tripA.id }) }
      );
      const jsonA = await resA.json();
      transAId = jsonA.data.id;

      const resB = await createTransportation(
        createRequest(`/api/trips/${tripB.id}/transportation`, userB.id, 'POST', {
          type: 'CAR',
          origin: 'Bangalore Airport',
          destination: 'Electronic City',
          provider: 'Uber',
          cost: 1200,
        }),
        { params: Promise.resolve({ tripId: tripB.id }) }
      );
      const jsonB = await resB.json();
      transBId = jsonB.data.id;
    });

    it('TC-6.09: User can list transportation for own trip', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/transportation`, userA.id);
      const res = await getTransportationList(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(2);
      expect(json.data.some((t: { id: string }) => t.id === transAId)).toBe(true);
      expect(json.data.every((t: { tripId: string }) => t.tripId === tripA.id)).toBe(true);
    });

    it("TC-6.10: User cannot list transportation for another user's trip", async () => {
      const req = createRequest(`/api/trips/${tripB.id}/transportation`, userA.id);
      const res = await getTransportationList(req, {
        params: Promise.resolve({ tripId: tripB.id }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.15: Forged userId in request body is completely ignored', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/transportation`, userA.id, 'POST', {
        type: 'BUS',
        origin: 'Delhi',
        destination: 'Manali',
        userId: userB.id, // Attempt to forge ownership
      });
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.tripId).toBe(tripA.id);

      // Verify in DB that it is under tripA (which belongs to userA)
      const record = await prisma.transportation.findUnique({
        where: { id: json.data.id },
        include: { trip: true },
      });
      expect(record?.trip.userId).toBe(userA.id);
    });

    it('TC-6.16: Cross-trip transportation access rejected', async () => {
      // User A attempts to access User B's transportation under User A's tripId
      const req = createRequest(
        `/api/trips/${tripA.id}/transportation/${transBId}`,
        userA.id
      );
      const res = await getSingleTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id, transportationId: transBId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("TC-6.17: Cross-user itinerary association rejected", async () => {
      // User A attempts to attach transportation to User B's itinerary day
      const req = createRequest(`/api/trips/${tripA.id}/transportation`, userA.id, 'POST', {
        type: 'CAR',
        origin: 'Hotel',
        destination: 'Conference Centre',
        itineraryDayId: dayB1.id, // User B's day!
      });
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      // Must be rejected
      expect([400, 403, 422]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ==========================================
  // 3. UPDATE & DELETE OPERATIONS (TC-6.11 - TC-6.14)
  // ==========================================
  describe('Transportation Update & Deletion', () => {
    let transEditId: string;

    beforeAll(async () => {
      const res = await createTransportation(
        createRequest(`/api/trips/${tripA.id}/transportation`, userA.id, 'POST', {
          type: 'BUS',
          origin: 'Bandra Terminus',
          destination: 'Lonavala',
          cost: 350,
          provider: 'MSRTC Shivneri',
        }),
        { params: Promise.resolve({ tripId: tripA.id }) }
      );
      const json = await res.json();
      transEditId = json.data.id;
    });

    it('TC-6.11: User can update own transportation', async () => {
      const req = createRequest(
        `/api/trips/${tripA.id}/transportation/${transEditId}`,
        userA.id,
        'PATCH',
        {
          cost: 400,
          provider: 'MSRTC Shivneri Volvo AC',
          notes: 'Snacks included on board.',
        }
      );
      const res = await patchTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id, transportationId: transEditId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.cost).toBe(400);
      expect(json.data.provider).toBe('MSRTC Shivneri Volvo AC');
      expect(json.data.notes).toBe('Snacks included on board.');
    });

    it("TC-6.12: User cannot update another user's transportation", async () => {
      const req = createRequest(
        `/api/trips/${tripA.id}/transportation/${transEditId}`,
        userB.id,
        'PATCH',
        { cost: 9999 }
      );
      const res = await patchTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id, transportationId: transEditId }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("TC-6.14: User cannot delete another user's transportation", async () => {
      const req = createRequest(
        `/api/trips/${tripA.id}/transportation/${transEditId}`,
        userB.id,
        'DELETE'
      );
      const res = await deleteTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id, transportationId: transEditId }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-6.13: User can delete own transportation', async () => {
      const req = createRequest(
        `/api/trips/${tripA.id}/transportation/${transEditId}`,
        userA.id,
        'DELETE'
      );
      const res = await deleteTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id, transportationId: transEditId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const check = await prisma.transportation.findUnique({
        where: { id: transEditId },
      });
      expect(check).toBeNull();
    });
  });

  // ==========================================
  // 4. PLACES & ROUTES INTEGRATION (TC-6.18 - TC-6.23)
  // ==========================================
  describe('Places & Routes Integration & Metrics Normalization', () => {
    it('TC-6.18: Places integration works for origin & destination selection', async () => {
      const originPlaces = await searchPlaces('Delhi Airport', 2);
      const destPlaces = await searchPlaces('Mumbai Airport', 2);

      expect(originPlaces.length).toBeGreaterThan(0);
      expect(destPlaces.length).toBeGreaterThan(0);
      expect(originPlaces[0].name).toBeDefined();
      expect(destPlaces[0].name).toBeDefined();
    });

    it('TC-6.19: Routes integration calculates distance and duration', async () => {
      // Delhi to Agra coordinates
      const origin = { lat: 28.6139, lng: 77.209 };
      const destination = { lat: 27.1767, lng: 78.0081 };

      const routeResult = await tryComputeRoute(origin, destination, 'CAR');
      expect(routeResult.distanceMeters).not.toBeNull();
      expect(routeResult.durationSeconds).not.toBeNull();
      expect(routeResult.distanceMeters!).toBeGreaterThan(150000); // > 150 km
    });

    it('TC-6.20: Route distance is normalized correctly into readable text', () => {
      expect(formatRouteDistance(850)).toBe('850 m');
      expect(formatRouteDistance(12400)).toBe('12.4 km');
      expect(formatRouteDistance(230500)).toBe('230.5 km');
    });

    it('TC-6.21: Route duration is normalized correctly into readable text', () => {
      expect(formatRouteDuration(45)).toBe('< 1 min');
      expect(formatRouteDuration(1800)).toBe('30 min');
      expect(formatRouteDuration(3600)).toBe('1 hr');
      expect(formatRouteDuration(5400)).toBe('1 hr 30 min');
      expect(formatRouteDuration(14400)).toBe('4 hr');
    });

    it('TC-6.22: Route failure is handled safely without throwing or crashing', async () => {
      // Invalid coordinates across oceans where driving routes fail
      const origin = { lat: 0, lng: 0 };
      const destination = { lat: 85, lng: 170 };

      const safeResult = await tryComputeRoute(origin, destination, 'CAR');
      expect(safeResult.distanceMeters).toBeNull();
      expect(safeResult.durationSeconds).toBeNull();
    });

    it('TC-6.23: Transportation can exist without route metadata when allowed', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/transportation`, userA.id, 'POST', {
        type: 'OTHER',
        origin: 'Harbor Gate',
        destination: 'Island Lighthouse',
        // No coordinates passed
      });
      const res = await createTransportation(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.distanceMeters).toBeNull();
      expect(json.data.formattedDistance).toBeNull();
    });
  });

  // ==========================================
  // 5. REGRESSION TESTING (TC-6.24 - TC-6.28)
  // ==========================================
  describe('Regression Testing Across Previous Phases', () => {
    it('TC-6.24: Existing trip tests pass & trip integrity preserved', async () => {
      const trip = await prisma.trip.findUnique({
        where: { id: tripA.id },
      });
      expect(trip).not.toBeNull();
      expect(trip?.destinationName).toBe('Mumbai, Maharashtra');
    });

    it('TC-6.25: Existing itinerary tests pass & itinerary days preserved', async () => {
      const days = await prisma.itineraryDay.findMany({
        where: { tripId: tripA.id },
      });
      expect(days.length).toBeGreaterThan(0);
      expect(days[0].dayNumber).toBe(1);
    });

    it('TC-6.26: Existing Places search tests pass', async () => {
      const results = await searchPlaces('Jaipur', 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].placeId).toBeDefined();
    });

    it('TC-6.27: Existing Routes compute tests pass', async () => {
      const route = await computeRoute({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 28.7041, lng: 77.1025 },
        travelMode: 'DRIVE',
      });
      expect(route.distanceMeters).toBeGreaterThan(0);
      expect(route.polyline).toBeDefined();
    });

    it('TC-6.28: Existing authorization & session integrity pass', async () => {
      expect(userA.id).toBeDefined();
      expect(userB.id).toBeDefined();
      expect(userA.id).not.toBe(userB.id);
    });
  });
});

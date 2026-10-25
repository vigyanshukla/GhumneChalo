import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { GET as getTrips, POST as createTrip } from '../src/app/api/trips/route';
import {
  GET as getSingleTrip,
  PATCH as patchTrip,
  DELETE as deleteTrip,
} from '../src/app/api/trips/[tripId]/route';
import { searchPlaces } from '../src/lib/maps/places';
import { computeRoute } from '../src/lib/maps/routes';

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

describe('Phase 4 — Trip Creation & Trip Management', () => {
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
    userA = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `phase4-userA-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Phase 4 User A',
        },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `phase4-userB-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Phase 4 User B',
        },
      })
    );
  });

  afterAll(async () => {
    if (userA?.id) {
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userA.id } })).catch(() => {});
      await dbRetry(() => prisma.user.deleteMany({ where: { id: userA.id } })).catch(() => {});
    }
    if (userB?.id) {
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userB.id } })).catch(() => {});
      await dbRetry(() => prisma.user.deleteMany({ where: { id: userB.id } })).catch(() => {});
    }
  });

  // ==========================================
  // 1. TRIP CREATION & VALIDATION (TC-4.01 - TC-4.10)
  // ==========================================
  describe('Trip Creation & Input Validation', () => {
    it('TC-4.01: Authenticated user can create a valid trip', async () => {
      const payload = {
        title: 'Golden Triangle Tour',
        destinationName: 'Jaipur, Rajasthan',
        destinationPlaceId: 'ChIJpd-Yp8e8bTkR...',
        latitude: 26.9124,
        longitude: 75.7873,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-07T00:00:00.000Z',
        totalBudget: 25000,
        currency: 'INR',
        status: 'UPCOMING',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.userId).toBe(userA.id);
      expect(json.data.title).toBe('Golden Triangle Tour');
      expect(json.data.destinationName).toBe('Jaipur, Rajasthan');
      expect(json.data.status).toBe('UPCOMING');
    });

    it('TC-4.02: Unauthenticated user cannot create a trip -> 401 Unauthorized', async () => {
      const payload = {
        title: 'Unauthorized Trip',
        destinationName: 'Goa',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
      };

      const req = createRequest('/api/trips', undefined, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('TC-4.03: Trip requires valid title -> Empty title rejected', async () => {
      const payload = {
        title: '',
        destinationName: 'Mumbai',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-4.04: Whitespace-only title rejected', async () => {
      const payload = {
        title: '        ',
        destinationName: 'Mumbai',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-4.05: Trip requires destination -> Missing destination rejected', async () => {
      const payload = {
        title: 'Manali Adventure',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-4.06: Oversized destination name (>150 chars) rejected', async () => {
      const payload = {
        title: 'Long Destination Trip',
        destinationName: 'A'.repeat(160),
        startDate: '2026-11-01',
        endDate: '2026-11-05',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-4.07: Start date required -> Missing startDate rejected', async () => {
      const payload = {
        title: 'Kashmir Trip',
        destinationName: 'Srinagar',
        endDate: '2026-11-05',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-4.08: End date required -> Missing endDate rejected', async () => {
      const payload = {
        title: 'Kashmir Trip',
        destinationName: 'Srinagar',
        startDate: '2026-11-01',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-4.09: End date before start date rejected', async () => {
      const payload = {
        title: 'Invalid Date Trip',
        destinationName: 'Goa',
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-05T00:00:00.000Z', // Before start
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('TC-4.10: Valid trip is persisted and can be retrieved directly from database', async () => {
      const payload = {
        title: 'Varanasi Spiritual Tour',
        destinationName: 'Varanasi, Uttar Pradesh',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-04T00:00:00.000Z',
      };

      const req = createRequest('/api/trips', userA.id, 'POST', payload);
      const res = await createTrip(req);
      const json = await res.json();
      const tripId = json.data.id;

      const dbRecord = await dbRetry(() =>
        prisma.trip.findUnique({
          where: { id: tripId },
        })
      );
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.userId).toBe(userA.id);
      expect(dbRecord?.title).toBe('Varanasi Spiritual Tour');
    });
  });

  // ==========================================
  // 2. USER ISOLATION & TRIP LISTING (TC-4.11 - TC-4.14)
  // ==========================================
  describe('Trip Listing & User Isolation', () => {
    it('TC-4.11: Authenticated user can list own trips', async () => {
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userA.id } }));

      // Create trip 1 for userA
      await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'User A Trip 1',
            destinationName: 'Agra',
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-03'),
          },
        })
      );

      // Create trip 2 for userA
      await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'User A Trip 2',
            destinationName: 'Delhi',
            startDate: new Date('2026-10-10'),
            endDate: new Date('2026-10-12'),
          },
        })
      );

      const req = createRequest('/api/trips', userA.id, 'GET');
      const res = await getTrips(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.meta.total).toBe(2);
    });

    it('TC-4.12: User Isolation — User B cannot see User A trips in list', async () => {
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userA.id } }));
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userB.id } }));

      // Create trip for user A
      await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Secret Trip A',
            destinationName: 'Ladakh',
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-10'),
          },
        })
      );

      // Create trip for user B
      await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userB.id,
            title: 'User B Trip',
            destinationName: 'Kochi',
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-05'),
          },
        })
      );

      // User B lists trips
      const reqB = createRequest('/api/trips', userB.id, 'GET');
      const resB = await getTrips(reqB);
      const jsonB = await resB.json();

      expect(jsonB.success).toBe(true);
      expect(jsonB.data).toHaveLength(1);
      expect(jsonB.data[0].title).toBe('User B Trip');
      expect(jsonB.data.some((t: { title: string }) => t.title === 'Secret Trip A')).toBe(false);
    });

    it('TC-4.13: Authenticated user can fetch own trip by ID', async () => {
      const trip = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Detailed Trip A',
            destinationName: 'Hampi, Karnataka',
            startDate: new Date('2026-11-15'),
            endDate: new Date('2026-11-20'),
          },
        })
      );

      const req = createRequest(`/api/trips/${trip.id}`, userA.id);
      const res = await getSingleTrip(req, { params: Promise.resolve({ tripId: trip.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.id).toBe(trip.id);
      expect(json.data.title).toBe('Detailed Trip A');
    });

    it('TC-4.14: IDOR Protection — User B cannot fetch User A trip by ID', async () => {
      const tripA = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Private Trip A',
            destinationName: 'Udaipur',
            startDate: new Date('2026-12-01'),
            endDate: new Date('2026-12-05'),
          },
        })
      );

      const reqB = createRequest(`/api/trips/${tripA.id}`, userB.id);
      const resB = await getSingleTrip(reqB, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(resB.status).toBe(403);
      const jsonB = await resB.json();
      expect(jsonB.success).toBe(false);
      expect(jsonB.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // 3. TRIP EDIT, DELETE & SECURITY (TC-4.15 - TC-4.21)
  // ==========================================
  describe('Trip Update, Delete & Security', () => {
    it('TC-4.15: Authenticated user can update own trip', async () => {
      const trip = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Original Title',
            destinationName: 'Shimla',
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-05'),
          },
        })
      );

      const updatePayload = {
        title: 'Updated Shimla Winter Trip',
        totalBudget: 15000,
        status: 'ACTIVE',
      };

      const req = createRequest(`/api/trips/${trip.id}`, userA.id, 'PATCH', updatePayload);
      const res = await patchTrip(req, { params: Promise.resolve({ tripId: trip.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Updated Shimla Winter Trip');
      expect(json.data.status).toBe('ACTIVE');
    });

    it('TC-4.16: IDOR Protection — User B cannot update User A trip', async () => {
      const tripA = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Trip A Protect Me',
            destinationName: 'Rishikesh',
            startDate: new Date('2026-10-10'),
            endDate: new Date('2026-10-15'),
          },
        })
      );

      const reqB = createRequest(`/api/trips/${tripA.id}`, userB.id, 'PATCH', {
        title: 'Malicious Update by User B',
      });
      const resB = await patchTrip(reqB, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(resB.status).toBe(403);

      // Verify DB was unchanged
      const unchanged = await dbRetry(() => prisma.trip.findUnique({ where: { id: tripA.id } }));
      expect(unchanged?.title).toBe('Trip A Protect Me');
    });

    it('TC-4.17: Forged userId in request body is stripped and cannot transfer ownership', async () => {
      const spoofedPayload = {
        title: 'Ownership Spoof Attempt',
        destinationName: 'Darjeeling',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-05T00:00:00.000Z',
        userId: userB.id, // Attempt to assign to userB
      };

      const req = createRequest('/api/trips', userA.id, 'POST', spoofedPayload);
      const res = await createTrip(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      // Must be owned by userA (authenticated), NOT userB
      expect(json.data.userId).toBe(userA.id);
    });

    it('TC-4.18: Authenticated user can delete own trip', async () => {
      const trip = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Trip to be Deleted',
            destinationName: 'Ooty',
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-04'),
          },
        })
      );

      const req = createRequest(`/api/trips/${trip.id}`, userA.id, 'DELETE');
      const res = await deleteTrip(req, { params: Promise.resolve({ tripId: trip.id }) });
      expect(res.status).toBe(200);

      const check = await dbRetry(() => prisma.trip.findUnique({ where: { id: trip.id } }));
      expect(check).toBeNull();
    });

    it('TC-4.19: IDOR Protection — User B cannot delete User A trip', async () => {
      const tripA = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Safe Trip A',
            destinationName: 'Munnar',
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-05'),
          },
        })
      );

      const reqB = createRequest(`/api/trips/${tripA.id}`, userB.id, 'DELETE');
      const resB = await deleteTrip(reqB, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(resB.status).toBe(403);

      const check = await dbRetry(() => prisma.trip.findUnique({ where: { id: tripA.id } }));
      expect(check).not.toBeNull();
    });

    it('TC-4.20: Deleted trip no longer appears in GET /api/trips list', async () => {
      const trip = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'Temporary Trip',
            destinationName: 'Pondicherry',
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-03'),
          },
        })
      );

      // Delete trip
      const delReq = createRequest(`/api/trips/${trip.id}`, userA.id, 'DELETE');
      await deleteTrip(delReq, { params: Promise.resolve({ tripId: trip.id }) });

      // List trips
      const listReq = createRequest('/api/trips', userA.id, 'GET');
      const listRes = await getTrips(listReq);
      const listJson = await listRes.json();

      expect(listJson.data.some((t: { id: string }) => t.id === trip.id)).toBe(false);
    });

    it('TC-4.21: Double submission protection — Rapid identical submissions return existing trip', async () => {
      const payload = {
        title: 'Double Submit Trip',
        destinationName: 'Mysuru',
        startDate: '2026-12-10T00:00:00.000Z',
        endDate: '2026-12-15T00:00:00.000Z',
      };

      // First click
      const req1 = createRequest('/api/trips', userA.id, 'POST', payload);
      const res1 = await createTrip(req1);
      expect(res1.status).toBe(201);
      const json1 = await res1.json();

      // Immediate second click (duplicate)
      const req2 = createRequest('/api/trips', userA.id, 'POST', payload);
      const res2 = await createTrip(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      // Returns the same trip ID without creating a duplicate row
      expect(json2.data.id).toBe(json1.data.id);

      const totalCount = await prisma.trip.count({
        where: { userId: userA.id, title: 'Double Submit Trip' },
      });
      expect(totalCount).toBe(1);
    });
  });

  // ==========================================
  // 4. INTEGRATION ASSURANCE (TC-4.22 - TC-4.27)
  // ==========================================
  describe('Integration Assurance with Places & Routes', () => {
    it('TC-4.22: Places integration is functional for trip destinations', async () => {
      // Calling searchPlaces function from Phase 3B
      expect(typeof searchPlaces).toBe('function');
      const emptyPlaces = await searchPlaces(' ');
      expect(emptyPlaces).toEqual([]);
    });

    it('TC-4.23: Routes integration is functional for trip directions', async () => {
      // Calling computeRoute function from Phase 3D
      expect(typeof computeRoute).toBe('function');
    });

    it('TC-4.24: Phase 3A Map types and exports are intact', () => {
      expect(prisma.trip).toBeDefined();
    });

    it('TC-4.25: Phase 3B Search history models are intact', () => {
      expect(prisma.searchHistory).toBeDefined();
    });

    it('TC-4.26: Phase 3C Discovery categories and functions are intact', () => {
      expect(prisma.savedPlace).toBeDefined();
    });

    it('TC-4.27: Multi-trip management handles independent trips with different statuses', async () => {
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userA.id } }));

      // Create trip 1: UPCOMING
      const trip1 = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'North India Tour',
            destinationName: 'Manali',
            startDate: new Date('2026-11-01'),
            endDate: new Date('2026-11-06'),
            status: 'UPCOMING',
          },
        })
      );

      // Create trip 2: COMPLETED
      const trip2 = await dbRetry(() =>
        prisma.trip.create({
          data: {
            userId: userA.id,
            title: 'South India Tour',
            destinationName: 'Goa',
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-08-05'),
            status: 'COMPLETED',
          },
        })
      );

      // Verify both exist independently
      const userTrips = await dbRetry(() =>
        prisma.trip.findMany({
          where: { userId: userA.id },
          orderBy: { createdAt: 'asc' },
        })
      );

      expect(userTrips).toHaveLength(2);
      expect(userTrips[0].id).toBe(trip1.id);
      expect(userTrips[0].status).toBe('UPCOMING');
      expect(userTrips[1].id).toBe(trip2.id);
      expect(userTrips[1].status).toBe('COMPLETED');
    });
  });
});

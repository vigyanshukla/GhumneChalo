import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { POST as createTrip } from '../src/app/api/trips/route';
import { PATCH as patchTrip } from '../src/app/api/trips/[tripId]/route';
import { GET as getItinerary } from '../src/app/api/trips/[tripId]/itinerary/route';
import { POST as createDay } from '../src/app/api/trips/[tripId]/days/route';
import { POST as createItem } from '../src/app/api/trips/[tripId]/days/[dayId]/items/route';
import {
  PATCH as patchItem,
  DELETE as deleteItem,
} from '../src/app/api/trips/[tripId]/days/[dayId]/items/[itemId]/route';
import { PUT as reorderItems } from '../src/app/api/trips/[tripId]/days/[dayId]/items/reorder/route';
import { searchPlaces } from '../src/lib/maps/places';
import { computeRoute } from '../src/lib/maps/routes';
import { calculateDuration } from '../src/lib/itinerary-service';

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

describe('Phase 5 — Day-Wise Itinerary & Planning', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tripA: { id: string; title: string };
  let tripB: { id: string; title: string };

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
          email: `phase5-userA-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Phase 5 User A',
        },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `phase5-userB-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Phase 5 User B',
        },
      })
    );

    // Create Trip for User A (3 days: 2026-06-10 to 2026-06-12)
    const reqA = createRequest('/api/trips', userA.id, 'POST', {
      title: 'Jaipur Heritage Journey',
      destinationName: 'Jaipur, Rajasthan',
      startDate: '2026-06-10T00:00:00.000Z',
      endDate: '2026-06-12T00:00:00.000Z',
      currency: 'INR',
    });
    const resA = await createTrip(reqA);
    const jsonA = await resA.json();
    tripA = jsonA.data;

    // Create Trip for User B (2 days: 2026-07-01 to 2026-07-02)
    const reqB = createRequest('/api/trips', userB.id, 'POST', {
      title: 'Goa Coastal Getaway',
      destinationName: 'Goa, India',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-02T00:00:00.000Z',
      currency: 'INR',
    });
    const resB = await createTrip(reqB);
    const jsonB = await resB.json();
    tripB = jsonB.data;
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
  // 1. ITINERARY FETCH & INITIALIZATION (TC-5.01 - TC-5.05)
  // ==========================================
  describe('Itinerary Fetch & Day Management', () => {
    it('TC-5.01: Authenticated user can fetch itinerary', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/itinerary`, userA.id);
      const res = await getItinerary(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(3); // 3 days automatically initialized
      expect(json.data[0].dayNumber).toBe(1);
      expect(json.data[1].dayNumber).toBe(2);
      expect(json.data[2].dayNumber).toBe(3);
    });

    it('TC-5.02: Unauthenticated user cannot access itinerary', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/itinerary`);
      const res = await getItinerary(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-5.03: User can create itinerary day', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/days`, userA.id, 'POST', {
        title: 'Extra Day 4 — Shopping & Departure',
      });
      const res = await createDay(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.dayNumber).toBe(4);
      expect(json.data.title).toBe('Extra Day 4 — Shopping & Departure');
    });

    it('TC-5.04: Day belongs to correct trip', async () => {
      const days = await prisma.itineraryDay.findMany({
        where: { tripId: tripA.id },
      });
      for (const d of days) {
        expect(d.tripId).toBe(tripA.id);
      }
    });

    it("TC-5.05: User cannot create day in another user's trip", async () => {
      const req = createRequest(`/api/trips/${tripB.id}/days`, userA.id, 'POST', {
        title: 'Hacker Injected Day',
      });
      const res = await createDay(req, {
        params: Promise.resolve({ tripId: tripB.id }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ==========================================
  // 2. ITINERARY ITEMS MANAGEMENT (TC-5.06 - TC-5.12)
  // ==========================================
  describe('Itinerary Item Management & Ownership', () => {
    let day1Id: string;
    let itemId1: string;
    let itemId2: string;
    let itemId3: string;
    let dayBId: string;

    beforeAll(async () => {
      const d1 = await prisma.itineraryDay.findFirstOrThrow({
        where: { tripId: tripA.id, dayNumber: 1 },
      });
      day1Id = d1.id;

      const dB = await prisma.itineraryDay.findFirstOrThrow({
        where: { tripId: tripB.id, dayNumber: 1 },
      });
      dayBId = dB.id;
    });

    it('TC-5.06: User can add itinerary item', async () => {
      const payload = {
        name: 'Amber Fort',
        placeId: 'ChIJh8_8_amber_fort',
        latitude: 26.9855,
        longitude: 75.8513,
        startTime: '09:00',
        endTime: '12:00',
        notes: 'Take elephant ride or jeep up to the fort. Pre-book audio guide.',
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/days/${day1Id}/items`,
        userA.id,
        'POST',
        payload
      );
      const res = await createItem(req, {
        params: Promise.resolve({ tripId: tripA.id, dayId: day1Id }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Amber Fort');
      expect(json.data.order).toBe(0);
      itemId1 = json.data.id;
    });

    it('TC-5.07: Item belongs to correct day', async () => {
      const item = await prisma.itineraryItem.findUnique({
        where: { id: itemId1 },
      });
      expect(item).not.toBeNull();
      expect(item?.itineraryDayId).toBe(day1Id);
    });

    it("TC-5.08: User cannot add item to another user's day", async () => {
      const payload = {
        name: 'Malicious Activity',
        startTime: '10:00',
      };

      const req = createRequest(
        `/api/trips/${tripB.id}/days/${dayBId}/items`,
        userA.id,
        'POST',
        payload
      );
      const res = await createItem(req, {
        params: Promise.resolve({ tripId: tripB.id, dayId: dayBId }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-5.09: User can update own itinerary item', async () => {
      const updatePayload = {
        name: 'Amber Fort (Amer Palace)',
        notes: 'Audio guide tickets confirmed online.',
      };

      const req = createRequest(
        `/api/trips/${tripA.id}/days/${day1Id}/items/${itemId1}`,
        userA.id,
        'PATCH',
        updatePayload
      );
      const res = await patchItem(req, {
        params: Promise.resolve({
          tripId: tripA.id,
          dayId: day1Id,
          itemId: itemId1,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Amber Fort (Amer Palace)');
      expect(json.data.notes).toBe('Audio guide tickets confirmed online.');
    });

    it("TC-5.10: User cannot update another user's item", async () => {
      // User B creates an item in User B's day
      const itemB = await prisma.itineraryItem.create({
        data: {
          itineraryDayId: dayBId,
          name: 'Calangute Beach Visit',
          order: 0,
        },
      });

      // User A attempts to update User B's item
      const req = createRequest(
        `/api/trips/${tripB.id}/days/${dayBId}/items/${itemB.id}`,
        userA.id,
        'PATCH',
        { name: 'Defaced Beach' }
      );
      const res = await patchItem(req, {
        params: Promise.resolve({
          tripId: tripB.id,
          dayId: dayBId,
          itemId: itemB.id,
        }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("TC-5.12: User cannot delete another user's item", async () => {
      const itemB = await prisma.itineraryItem.findFirstOrThrow({
        where: { itineraryDayId: dayBId },
      });

      // User A attempts to delete User B's item
      const req = createRequest(
        `/api/trips/${tripB.id}/days/${dayBId}/items/${itemB.id}`,
        userA.id,
        'DELETE'
      );
      const res = await deleteItem(req, {
        params: Promise.resolve({
          tripId: tripB.id,
          dayId: dayBId,
          itemId: itemB.id,
        }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-5.11: User can delete own itinerary item', async () => {
      // Add a disposable item
      const tempItem = await prisma.itineraryItem.create({
        data: {
          itineraryDayId: day1Id,
          name: 'Disposable Activity',
          order: 99,
        },
      });

      const req = createRequest(
        `/api/trips/${tripA.id}/days/${day1Id}/items/${tempItem.id}`,
        userA.id,
        'DELETE'
      );
      const res = await deleteItem(req, {
        params: Promise.resolve({
          tripId: tripA.id,
          dayId: day1Id,
          itemId: tempItem.id,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const check = await prisma.itineraryItem.findUnique({
        where: { id: tempItem.id },
      });
      expect(check).toBeNull();
    });

    // ==========================================
    // 3. REORDERING (TC-5.13 - TC-5.15)
    // ==========================================
    describe('Item Reordering', () => {
      beforeAll(async () => {
        // Add items 2 and 3 to day 1
        const res2 = await createItem(
          createRequest(
            `/api/trips/${tripA.id}/days/${day1Id}/items`,
            userA.id,
            'POST',
            { name: 'City Palace', startTime: '13:00' }
          ),
          { params: Promise.resolve({ tripId: tripA.id, dayId: day1Id }) }
        );
        const json2 = await res2.json();
        itemId2 = json2.data.id;

        const res3 = await createItem(
          createRequest(
            `/api/trips/${tripA.id}/days/${day1Id}/items`,
            userA.id,
            'POST',
            { name: 'Hawa Mahal', startTime: '16:00' }
          ),
          { params: Promise.resolve({ tripId: tripA.id, dayId: day1Id }) }
        );
        const json3 = await res3.json();
        itemId3 = json3.data.id;
      });

      it('TC-5.13: User can reorder itinerary items', async () => {
        // Original order: itemId1 (0), itemId2 (1), itemId3 (2)
        // Desired reorder: [itemId3, itemId1, itemId2]
        const reorderPayload = {
          itemIds: [itemId3, itemId1, itemId2],
        };

        const req = createRequest(
          `/api/trips/${tripA.id}/days/${day1Id}/items/reorder`,
          userA.id,
          'PUT',
          reorderPayload
        );
        const res = await reorderItems(req, {
          params: Promise.resolve({ tripId: tripA.id, dayId: day1Id }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.length).toBe(3);
        expect(json.data[0].id).toBe(itemId3);
        expect(json.data[0].order).toBe(0);
        expect(json.data[1].id).toBe(itemId1);
        expect(json.data[1].order).toBe(1);
        expect(json.data[2].id).toBe(itemId2);
        expect(json.data[2].order).toBe(2);
      });

      it('TC-5.14: Order persists after reload', async () => {
        const reloadedItems = await prisma.itineraryItem.findMany({
          where: { itineraryDayId: day1Id },
          orderBy: { order: 'asc' },
        });

        expect(reloadedItems[0].id).toBe(itemId3);
        expect(reloadedItems[1].id).toBe(itemId1);
        expect(reloadedItems[2].id).toBe(itemId2);
      });

      it('TC-5.15: Duplicate order corruption is prevented', async () => {
        // Submitting invalid or mismatched itemIds is rejected
        const invalidPayload = {
          itemIds: [itemId1, 'invalid_id_not_in_day_12345'],
        };

        const req = createRequest(
          `/api/trips/${tripA.id}/days/${day1Id}/items/reorder`,
          userA.id,
          'PUT',
          invalidPayload
        );
        const res = await reorderItems(req, {
          params: Promise.resolve({ tripId: tripA.id, dayId: day1Id }),
        });

        expect(res.status).toBe(422);
        const json = await res.json();
        expect(json.success).toBe(false);
      });
    });
  });

  // ==========================================
  // 4. DATE SYNCHRONIZATION & DURATION (TC-5.16 - TC-5.19)
  // ==========================================
  describe('Trip Duration & Date Synchronization', () => {
    it('TC-5.16: Invalid date/day relationship rejected', async () => {
      // Trying to update trip with end date before start date is rejected
      const invalidDatesPayload = {
        startDate: '2026-08-10T00:00:00.000Z',
        endDate: '2026-08-05T00:00:00.000Z',
      };

      const req = createRequest(
        `/api/trips/${tripA.id}`,
        userA.id,
        'PATCH',
        invalidDatesPayload
      );
      const res = await patchTrip(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-5.17: Trip duration calculated correctly', () => {
      // 10 June to 12 June is 3 days
      const duration1 = calculateDuration('2026-06-10', '2026-06-12');
      expect(duration1).toBe(3);

      // Same-day trip (10 June to 10 June) is 1 day
      const duration2 = calculateDuration('2026-06-10', '2026-06-10');
      expect(duration2).toBe(1);

      // 7-day trip
      const duration3 = calculateDuration('2026-06-01', '2026-06-07');
      expect(duration3).toBe(7);
    });

    it('TC-5.18: Extending trip creates required additional days', async () => {
      // Trip A was originally 3 days. Day 4 was manually created in TC-5.03.
      // Let's extend trip from 2026-06-10 to 2026-06-15 (6 days).
      const req = createRequest(`/api/trips/${tripA.id}`, userA.id, 'PATCH', {
        endDate: '2026-06-15T00:00:00.000Z',
      });
      const res = await patchTrip(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(200);

      const daysAfterExtend = await prisma.itineraryDay.findMany({
        where: { tripId: tripA.id },
        orderBy: { dayNumber: 'asc' },
      });

      expect(daysAfterExtend.length).toBe(6);
      expect(daysAfterExtend[4].dayNumber).toBe(5);
      expect(daysAfterExtend[5].dayNumber).toBe(6);
    });

    it('TC-5.19: Shortening trip does not silently destroy planned items', async () => {
      // Add a planned item to Day 6
      const day6 = await prisma.itineraryDay.findFirstOrThrow({
        where: { tripId: tripA.id, dayNumber: 6 },
      });

      await prisma.itineraryItem.create({
        data: {
          itineraryDayId: day6.id,
          name: 'Important Departure Activity on Day 6',
          order: 0,
        },
      });

      // Try shortening trip to 3 days WITHOUT confirmShorten
      const reqFail = createRequest(`/api/trips/${tripA.id}`, userA.id, 'PATCH', {
        endDate: '2026-06-12T00:00:00.000Z',
      });
      const resFail = await patchTrip(reqFail, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      // Must be rejected with validation error to protect planned items
      expect(resFail.status).toBe(422);
      const jsonFail = await resFail.json();
      expect(jsonFail.success).toBe(false);
      expect(jsonFail.error.message).toContain('planned activities');

      // Verify Day 6 and its item are still intact
      const itemCheck = await prisma.itineraryItem.findFirst({
        where: { itineraryDayId: day6.id },
      });
      expect(itemCheck).not.toBeNull();
      expect(itemCheck?.name).toBe('Important Departure Activity on Day 6');

      // Now shorten with confirmShorten: true
      const reqConfirm = createRequest(`/api/trips/${tripA.id}`, userA.id, 'PATCH', {
        endDate: '2026-06-12T00:00:00.000Z',
        confirmShorten: true,
      });
      const resConfirm = await patchTrip(reqConfirm, {
        params: Promise.resolve({ tripId: tripA.id }),
      });
      expect(resConfirm.status).toBe(200);

      const daysAfterShorten = await prisma.itineraryDay.findMany({
        where: { tripId: tripA.id },
      });
      expect(daysAfterShorten.length).toBe(3);
    });
  });

  // ==========================================
  // 5. PLACES & NORMALIZATION INTEGRATION (TC-5.20 - TC-5.22)
  // ==========================================
  describe('Places & Routes Integration & User Isolation', () => {
    it('TC-5.20: Places integration works when adding an activity', async () => {
      const places = await searchPlaces('Jaipur Jal Mahal', 2);
      expect(Array.isArray(places)).toBe(true);
      expect(places.length).toBeGreaterThan(0);
      expect(places[0].name).toBeDefined();

      const day1 = await prisma.itineraryDay.findFirstOrThrow({
        where: { tripId: tripA.id, dayNumber: 1 },
      });

      const res = await createItem(
        createRequest(
          `/api/trips/${tripA.id}/days/${day1.id}/items`,
          userA.id,
          'POST',
          {
            name: places[0].name,
            placeId: places[0].placeId,
            latitude: places[0].latitude,
            longitude: places[0].longitude,
            startTime: '10:00',
          }
        ),
        { params: Promise.resolve({ tripId: tripA.id, dayId: day1.id }) }
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.placeId).toBe(places[0].placeId);
      expect(json.data.latitude).toBeCloseTo(places[0].latitude, 2);
      expect(json.data.longitude).toBeCloseTo(places[0].longitude, 2);
    });

    it('TC-5.21: Raw Google Place response is not persisted', async () => {
      const item = await prisma.itineraryItem.findFirstOrThrow({
        where: { name: { contains: 'Jal Mahal' } },
      });

      // ItineraryItem model stores only normalized fields:
      // id, itineraryDayId, placeId, name, latitude, longitude, startTime, endTime, notes, order
      const itemKeys = Object.keys(item);
      expect(itemKeys).not.toContain('googleRawResponse');
      expect(itemKeys).not.toContain('addressComponents');
      expect(itemKeys).not.toContain('photos');
    });

    it('TC-5.22: User isolation verified across all itinerary operations', async () => {
      // User B cannot access User A's itinerary
      const reqItinerary = createRequest(`/api/trips/${tripA.id}/itinerary`, userB.id);
      const resItinerary = await getItinerary(reqItinerary, {
        params: Promise.resolve({ tripId: tripA.id }),
      });
      expect(resItinerary.status).toBe(403);

      // User B cannot add day to User A's trip
      const reqAddDay = createRequest(`/api/trips/${tripA.id}/days`, userB.id, 'POST', {
        title: 'Hacked Day',
      });
      const resAddDay = await createDay(reqAddDay, {
        params: Promise.resolve({ tripId: tripA.id }),
      });
      expect(resAddDay.status).toBe(403);
    });
  });

  // ==========================================
  // 6. REGRESSION TESTS (TC-5.23 - TC-5.25)
  // ==========================================
  describe('Regression Testing', () => {
    it('TC-5.23: Existing trip operations remain functional', async () => {
      const trip = await prisma.trip.findUnique({
        where: { id: tripA.id },
      });
      expect(trip).not.toBeNull();
      expect(trip?.destinationName).toBe('Jaipur, Rajasthan');
    });

    it('TC-5.24: Existing places search remains functional', async () => {
      const results = await searchPlaces('Goa', 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].placeId).toBeDefined();
    });

    it('TC-5.25: Existing routes compute remains functional', async () => {
      const route = await computeRoute({
        origin: { lat: 26.9124, lng: 75.7873 },
        destination: { lat: 26.9855, lng: 75.8513 },
        travelMode: 'DRIVE',
      });
      expect(route.distanceMeters).toBeGreaterThan(0);
      expect(route.durationSeconds).toBeGreaterThan(0);
      expect(route.polyline).toBeDefined();
    });
  });
});

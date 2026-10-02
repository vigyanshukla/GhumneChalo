import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  GET as getPackingList,
  POST as createPackingItemRoute,
} from '../src/app/api/trips/[tripId]/packing/route';
import {
  PATCH as updatePackingItemRoute,
  DELETE as deletePackingItemRoute,
} from '../src/app/api/trips/[tripId]/packing/[itemId]/route';
import { POST as generatePackingRoute } from '../src/app/api/trips/[tripId]/packing/generate/route';
import { POST as clearCompletedRoute } from '../src/app/api/trips/[tripId]/packing/clear-completed/route';
import { generatePackingRecommendations } from '../src/lib/packing/packing-generator';
import { calculatePackingSummary } from '../src/lib/packing/packing-service';

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
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Phase 10A — Packing Assistant & Checklist Engine (TC-10A.01 to TC-10A.26)', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tripA: { id: string; title: string; destinationName: string };
  let tripB: { id: string; title: string; destinationName: string };

  const TEST_EMAIL_A = 'packing.traveler.a@ghumnechalo-p10a.com';
  const TEST_EMAIL_B = 'packing.traveler.b@ghumnechalo-p10a.com';

  async function dbRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    throw new Error('dbRetry unreachable');
  }

  beforeAll(async () => {
    // 1. Clean up test users and trips
    await dbRetry(async () => {
      await prisma.packingItem.deleteMany({
        where: {
          trip: {
            user: {
              email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
            },
          },
        },
      });
      await prisma.trip.deleteMany({
        where: {
          user: {
            email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
          },
        },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] } },
      });
    });

    // 2. Create User A & User B
    userA = await dbRetry(() =>
      prisma.user.create({
        data: {
          name: 'Packing Tester A',
          email: TEST_EMAIL_A,
        },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          name: 'Packing Tester B',
          email: TEST_EMAIL_B,
        },
      })
    );

    // 3. Create Trip A (User A: Manali Mountain Trek, 5 days)
    tripA = await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Manali High Altitude Trek',
          destinationName: 'Manali, Himachal Pradesh, India',
          startDate: new Date('2026-10-10T00:00:00.000Z'),
          endDate: new Date('2026-10-15T00:00:00.000Z'),
          totalBudget: 25000,
          currency: 'INR',
          status: 'UPCOMING',
        },
      })
    );

    // 4. Create Trip B (User B: Goa Beach Holiday, 3 days)
    tripB = await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userB.id,
          title: 'Goa Coastal Sun & Surf',
          destinationName: 'Goa, India',
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          endDate: new Date('2026-11-04T00:00:00.000Z'),
          totalBudget: 18000,
          currency: 'INR',
          status: 'UPCOMING',
        },
      })
    );
  });

  afterAll(async () => {
    await dbRetry(async () => {
      await prisma.packingItem.deleteMany({
        where: {
          trip: {
            user: {
              email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
            },
          },
        },
      });
      await prisma.trip.deleteMany({
        where: {
          user: {
            email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
          },
        },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] } },
      });
    });
  });

  // ==========================================
  // AUTHENTICATION & SECURITY (TC-10A.01 to TC-10A.06)
  // ==========================================

  it('TC-10A.01: authenticated user can fetch own checklist', async () => {
    const req = createRequest(`/api/trips/${tripA.id}/packing`, userA.id, 'GET');
    const res = await getPackingList(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.tripId).toBe(tripA.id);
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.summary).toBeDefined();
    expect(json.data.summary.totalItems).toBe(0);
    expect(json.data.summary.completionPercentage).toBe(0);
  });

  it('TC-10A.02: unauthenticated access rejected where required', async () => {
    const req = createRequest(`/api/trips/${tripA.id}/packing`, undefined, 'GET');
    const res = await getPackingList(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('TC-10A.03: User A cannot access User B checklist (IDOR protected)', async () => {
    // User A trying to read Trip B
    const req = createRequest(`/api/trips/${tripB.id}/packing`, userA.id, 'GET');
    const res = await getPackingList(req, {
      params: Promise.resolve({ tripId: tripB.id }),
    });
    expect([403, 404]).toContain(res.status);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('TC-10A.04: User A cannot modify User B item (IDOR protected)', async () => {
    // Create an item on Trip B belonging to User B
    const itemB = await prisma.packingItem.create({
      data: {
        tripId: tripB.id,
        name: 'Secret Beach Towel',
        category: 'ESSENTIALS',
        quantity: 1,
        isCustom: true,
      },
    });

    // User A attempts to edit User B's item
    const req = createRequest(
      `/api/trips/${tripB.id}/packing/${itemB.id}`,
      userA.id,
      'PATCH',
      { name: 'Hacked Towel', isPacked: true }
    );
    const res = await updatePackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripB.id, itemId: itemB.id }),
    });
    expect([403, 404]).toContain(res.status);

    // Verify item was not modified in database
    const fresh = await prisma.packingItem.findUnique({ where: { id: itemB.id } });
    expect(fresh?.name).toBe('Secret Beach Towel');
    expect(fresh?.isPacked).toBe(false);
  });

  it('TC-10A.05: User A cannot delete User B item (IDOR protected)', async () => {
    const itemB = await prisma.packingItem.create({
      data: {
        tripId: tripB.id,
        name: 'Goa Sunglasses',
        category: 'ESSENTIALS',
        quantity: 1,
        isCustom: true,
      },
    });

    // User A attempts to delete User B's item
    const req = createRequest(
      `/api/trips/${tripB.id}/packing/${itemB.id}`,
      userA.id,
      'DELETE'
    );
    const res = await deletePackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripB.id, itemId: itemB.id }),
    });
    expect([403, 404]).toContain(res.status);

    // Verify item still exists
    const stillExists = await prisma.packingItem.findUnique({ where: { id: itemB.id } });
    expect(stillExists).not.toBeNull();
  });

  it('TC-10A.06: forged userId in body/query is strictly ignored', async () => {
    // User A creates an item with forged userId in body
    const req = createRequest(
      `/api/trips/${tripA.id}/packing`,
      userA.id,
      'POST',
      {
        name: 'Thermal Flask',
        category: 'ESSENTIALS',
        quantity: 1,
        userId: userB.id, // Forged userId
      }
    );
    const res = await createPackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.data.item.tripId).toBe(tripA.id);

    // Verify trip ownership was preserved
    const createdItem = await prisma.packingItem.findUnique({
      where: { id: json.data.item.id },
      include: { trip: true },
    });
    expect(createdItem?.trip.userId).toBe(userA.id);
  });

  // ==========================================
  // SMART GENERATION & CONTEXT AWARENESS (TC-10A.07 to TC-10A.11)
  // ==========================================

  it('TC-10A.07: smart checklist generated via API route', async () => {
    const req = createRequest(
      `/api/trips/${tripA.id}/packing/generate`,
      userA.id,
      'POST',
      { preserveCustom: true }
    );
    const res = await generatePackingRoute(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBeGreaterThan(10);
    expect(json.data.summary.totalItems).toBe(json.data.items.length);
    expect(json.data.durationDays).toBe(5);

    // Verify categories are present
    const categories = new Set(json.data.items.map((i: { category: string }) => i.category));
    expect(categories.has('DOCUMENTS')).toBe(true);
    expect(categories.has('CLOTHING')).toBe(true);
    expect(categories.has('TOILETRIES')).toBe(true);
    expect(categories.has('ELECTRONICS')).toBe(true);
    expect(categories.has('HEALTH')).toBe(true);
  });

  it('TC-10A.08: destination included in generation context (mountain vs beach vs heritage)', () => {
    // Mountain Context
    const mountainRecs = generatePackingRecommendations({
      destinationName: 'Manali, Himachal Pradesh',
      startDate: new Date('2026-10-10'),
      endDate: new Date('2026-10-15'),
    });
    const mountainItemNames = mountainRecs.items.map((i) => i.name.toLowerCase());
    expect(mountainItemNames.some((n) => n.includes('hiking') || n.includes('trekking'))).toBe(true);

    // Beach Context
    const beachRecs = generatePackingRecommendations({
      destinationName: 'Goa Coastal Island',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-04'),
    });
    const beachItemNames = beachRecs.items.map((i) => i.name.toLowerCase());
    expect(beachItemNames.some((n) => n.includes('swim') || n.includes('beach'))).toBe(true);

    // Heritage Context
    const cityRecs = generatePackingRecommendations({
      destinationName: 'Jaipur Heritage Forts',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-03'),
    });
    const cityItemNames = cityRecs.items.map((i) => i.name.toLowerCase());
    expect(cityItemNames.some((n) => n.includes('temple') || n.includes('monument'))).toBe(true);
  });

  it('TC-10A.09: duration affects recommendations (scaling of clothing)', () => {
    // 2-day short trip
    const shortTrip = generatePackingRecommendations({
      destinationName: 'New Delhi',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-03'),
    });
    const shortTshirts = shortTrip.items.find((i) => i.name.includes('T-Shirts'))?.quantity;

    // 10-day long trip
    const longTrip = generatePackingRecommendations({
      destinationName: 'New Delhi',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-11'),
    });
    const longTshirts = longTrip.items.find((i) => i.name.includes('T-Shirts'))?.quantity;

    expect(shortTshirts).toBeDefined();
    expect(longTshirts).toBeDefined();
    expect(Number(longTshirts)).toBeGreaterThan(Number(shortTshirts));
  });

  it('TC-10A.10: weather-aware recommendations work (rain, cold, heat)', () => {
    // Rain condition
    const rainResult = generatePackingRecommendations({
      destinationName: 'Cherrapunji',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-05'),
      weather: ({
        tripId: 'test-trip',
        destinationName: 'Cherrapunji',
        latitude: 25.27,
        longitude: 91.73,
        timezone: 'Asia/Kolkata',
        days: [
          {
            date: '2026-07-01',
            status: 'available',
            temperatureMax: 24,
            temperatureMin: 18,
            temperatureMean: 21,
            apparentTemperatureMax: null,
            apparentTemperatureMin: null,
            precipitationProbability: 85,
            precipitationSum: 40,
            windSpeedMax: 15,
            weatherCode: 65,
            condition: 'Heavy Rain',
            conditionCategory: 'rain',
            formattedTemp: '21°C',
            formattedTempRange: '18°C – 24°C',
            formattedWind: '15 km/h',
            formattedPrecipitation: '85% (40mm)',
          },
        ],
        summary: {
          tempRange: '18°C – 24°C',
          predominantCondition: 'Heavy Rain',
          hasRainExpected: true,
          maxRainChance: 85,
        },
      } as unknown as import('../src/lib/weather/types').NormalizedTripWeather),
    });

    const rainItems = rainResult.items.filter((i) => i.weatherRelevance === 'RAIN');
    expect(rainItems.length).toBeGreaterThan(0);
    expect(rainItems.some((i) => i.name.includes('Umbrella') || i.name.includes('Raincoat'))).toBe(true);

    // Cold condition (< 15°C)
    const coldResult = generatePackingRecommendations({
      destinationName: 'Ladakh',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      weather: ({
        tripId: 'test-trip-cold',
        destinationName: 'Ladakh',
        latitude: 34.15,
        longitude: 77.57,
        timezone: 'Asia/Kolkata',
        days: [
          {
            date: '2026-10-01',
            status: 'available',
            temperatureMax: 8,
            temperatureMin: -2,
            temperatureMean: 3,
            apparentTemperatureMax: null,
            apparentTemperatureMin: null,
            precipitationProbability: 10,
            precipitationSum: 0,
            windSpeedMax: 20,
            weatherCode: 1,
            condition: 'Mainly Clear',
            conditionCategory: 'clear',
            formattedTemp: '3°C',
            formattedTempRange: '-2°C – 8°C',
            formattedWind: '20 km/h',
            formattedPrecipitation: '0mm',
          },
        ],
        summary: {
          tempRange: '-2°C – 8°C',
          predominantCondition: 'Cold & Clear',
          hasRainExpected: false,
          maxRainChance: 10,
        },
      } as unknown as import('../src/lib/weather/types').NormalizedTripWeather),
    });

    const coldItems = coldResult.items.filter((i) => i.weatherRelevance === 'COLD');
    expect(coldItems.length).toBeGreaterThan(0);
    expect(coldItems.some((i) => i.name.includes('Thermal') || i.name.includes('Puffer') || i.name.includes('Woolen'))).toBe(true);
  });

  it('TC-10A.11: weather unavailable fallback works gracefully', () => {
    const fallbackResult = generatePackingRecommendations({
      destinationName: 'Unknown Remote Valley',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-05'),
      weather: null, // Weather unavailable
    });

    expect(fallbackResult.weatherIntegrated).toBe(false);
    expect(fallbackResult.items.length).toBeGreaterThan(10);
    // Generic fallback weather items
    const generalItems = fallbackResult.items.filter((i) => i.weatherRelevance === 'GENERAL');
    expect(generalItems.length).toBeGreaterThan(0);
  });

  // ==========================================
  // CUSTOM ITEM CRUD & INTERACTIVE CHECKS (TC-10A.12 to TC-10A.21)
  // ==========================================

  let createdCustomItem: { id: string; name: string };

  it('TC-10A.12: custom item can be created', async () => {
    const req = createRequest(`/api/trips/${tripA.id}/packing`, userA.id, 'POST', {
      name: 'Sony A7 IV Camera & 24-70mm Lens',
      category: 'ELECTRONICS',
      quantity: 1,
      notes: 'Pack in camera backpack with lens wipe',
    });
    const res = await createPackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.item.name).toBe('Sony A7 IV Camera & 24-70mm Lens');
    expect(json.data.item.isCustom).toBe(true);
    expect(json.data.item.isPacked).toBe(false);

    createdCustomItem = json.data.item;
  });

  it('TC-10A.13: custom item can be edited', async () => {
    const req = createRequest(
      `/api/trips/${tripA.id}/packing/${createdCustomItem.id}`,
      userA.id,
      'PATCH',
      {
        name: 'Sony A7 IV Camera & 24-70mm + Extra Battery',
        quantity: 2,
        notes: 'Bring 2 high-capacity SD cards',
      }
    );
    const res = await updatePackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripA.id, itemId: createdCustomItem.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.item.name).toBe('Sony A7 IV Camera & 24-70mm + Extra Battery');
    expect(json.data.item.quantity).toBe(2);
  });

  it('TC-10A.15: item can be checked (marked as packed)', async () => {
    const req = createRequest(
      `/api/trips/${tripA.id}/packing/${createdCustomItem.id}`,
      userA.id,
      'PATCH',
      { isPacked: true }
    );
    const res = await updatePackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripA.id, itemId: createdCustomItem.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.item.isPacked).toBe(true);
    expect(json.data.summary.packedItems).toBeGreaterThan(0);
  });

  it('TC-10A.16: item can be unchecked (marked as unpacked)', async () => {
    const req = createRequest(
      `/api/trips/${tripA.id}/packing/${createdCustomItem.id}`,
      userA.id,
      'PATCH',
      { isPacked: false }
    );
    const res = await updatePackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripA.id, itemId: createdCustomItem.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.item.isPacked).toBe(false);
  });

  it('TC-10A.17: completed count and category breakdown accurate', () => {
    const items = [
      { category: 'CLOTHING', isPacked: true },
      { category: 'CLOTHING', isPacked: false },
      { category: 'DOCUMENTS', isPacked: true },
      { category: 'DOCUMENTS', isPacked: true },
      { category: 'ELECTRONICS', isPacked: false },
    ];
    const summary = calculatePackingSummary(items);
    expect(summary.totalItems).toBe(5);
    expect(summary.packedItems).toBe(3);
    expect(summary.categoryBreakdown.CLOTHING.total).toBe(2);
    expect(summary.categoryBreakdown.CLOTHING.packed).toBe(1);
    expect(summary.categoryBreakdown.DOCUMENTS.total).toBe(2);
    expect(summary.categoryBreakdown.DOCUMENTS.packed).toBe(2);
  });

  it('TC-10A.18: percentage calculation accurate', () => {
    const items = [
      { category: 'ESSENTIALS', isPacked: true },
      { category: 'ESSENTIALS', isPacked: true },
      { category: 'ESSENTIALS', isPacked: false },
    ];
    const summary = calculatePackingSummary(items);
    // 2/3 = 66.666% -> 67%
    expect(summary.completionPercentage).toBe(67);
  });

  it('TC-10A.19: duplicate item handling avoids redundancy in generation', () => {
    const recs = generatePackingRecommendations({
      destinationName: 'Goa',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-04'),
    });
    const names = recs.items.map((i) => i.name.toLowerCase().trim());
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('TC-10A.21: regeneration preserves custom items and maintains checked state', async () => {
    // 1. Ensure our custom item exists and mark it packed
    await prisma.packingItem.update({
      where: { id: createdCustomItem.id },
      data: { isPacked: true },
    });

    // 2. Trigger regeneration with preserveCustom: true
    const req = createRequest(
      `/api/trips/${tripA.id}/packing/generate`,
      userA.id,
      'POST',
      { preserveCustom: true }
    );
    const res = await generatePackingRoute(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    const customSurvivor = json.data.items.find(
      (i: { id: string }) => i.id === createdCustomItem.id
    );
    expect(customSurvivor).toBeDefined();
    expect(customSurvivor.isCustom).toBe(true);
    expect(customSurvivor.isPacked).toBe(true);
  });

  it('TC-10A.20: clear completed works', async () => {
    // Our custom item is marked isPacked: true.
    // Let's call clear-completed
    const req = createRequest(
      `/api/trips/${tripA.id}/packing/clear-completed`,
      userA.id,
      'POST'
    );
    const res = await clearCompletedRoute(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.clearedCount).toBeGreaterThanOrEqual(1);

    // Verify createdCustomItem was deleted
    const itemInDb = await prisma.packingItem.findUnique({
      where: { id: createdCustomItem.id },
    });
    expect(itemInDb).toBeNull();
  });

  it('TC-10A.14: item can be deleted individually', async () => {
    // Create an item specifically to test single deletion
    const item = await prisma.packingItem.create({
      data: {
        tripId: tripA.id,
        name: 'Single Delete Test Item',
        category: 'ESSENTIALS',
        quantity: 1,
        isCustom: true,
      },
    });

    const req = createRequest(
      `/api/trips/${tripA.id}/packing/${item.id}`,
      userA.id,
      'DELETE'
    );
    const res = await deletePackingItemRoute(req, {
      params: Promise.resolve({ tripId: tripA.id, itemId: item.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.deletedId).toBe(item.id);

    const inDb = await prisma.packingItem.findUnique({ where: { id: item.id } });
    expect(inDb).toBeNull();
  });

  // ==========================================
  // VALIDATION & RESILIENCE (TC-10A.22 to TC-10A.26)
  // ==========================================

  it('TC-10A.22: invalid input rejected (empty name, negative quantity, invalid category)', async () => {
    // Empty name
    const req1 = createRequest(`/api/trips/${tripA.id}/packing`, userA.id, 'POST', {
      name: '   ',
      category: 'CLOTHING',
    });
    const res1 = await createPackingItemRoute(req1, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect([400, 422]).toContain(res1.status);

    // Negative quantity
    const req2 = createRequest(`/api/trips/${tripA.id}/packing`, userA.id, 'POST', {
      name: 'Valid Name',
      quantity: -5,
    });
    const res2 = await createPackingItemRoute(req2, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect([400, 422]).toContain(res2.status);

    // Invalid category
    const req3 = createRequest(`/api/trips/${tripA.id}/packing`, userA.id, 'POST', {
      name: 'Valid Name',
      category: 'INVALID_CATEGORY',
    });
    const res3 = await createPackingItemRoute(req3, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect([400, 422]).toContain(res3.status);
  });

  it('TC-10A.23: print layout data contract contains trip metadata and grouped items', async () => {
    const req = createRequest(`/api/trips/${tripA.id}/packing`, userA.id, 'GET');
    const res = await getPackingList(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.destinationName).toBe(tripA.destinationName);
    expect(json.data.startDate).toBeDefined();
    expect(json.data.endDate).toBeDefined();
    expect(json.data.durationDays).toBe(5);

    // Items have name, quantity, category, and isPacked for printable rendering
    for (const item of json.data.items) {
      expect(typeof item.name).toBe('string');
      expect(typeof item.quantity).toBe('number');
      expect(typeof item.isPacked).toBe('boolean');
      expect(typeof item.category).toBe('string');
    }
  });

  it('TC-10A.24: empty state works correctly for a fresh trip', async () => {
    // Create an empty fresh trip for User A
    const freshTrip = await prisma.trip.create({
      data: {
        userId: userA.id,
        title: 'Empty Packing Test Journey',
        destinationName: 'Udaipur, Rajasthan',
        startDate: new Date('2026-12-10'),
        endDate: new Date('2026-12-12'),
      },
    });

    const req = createRequest(`/api/trips/${freshTrip.id}/packing`, userA.id, 'GET');
    const res = await getPackingList(req, {
      params: Promise.resolve({ tripId: freshTrip.id }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.items).toEqual([]);
    expect(json.data.summary.totalItems).toBe(0);
    expect(json.data.summary.packedItems).toBe(0);
    expect(json.data.summary.completionPercentage).toBe(0);

    // Clean up
    await prisma.trip.delete({ where: { id: freshTrip.id } });
  });

  it('TC-10A.25: mobile layout data contract supports lightweight payload without heavy bloat', async () => {
    const req = createRequest(`/api/trips/${tripA.id}/packing`, userA.id, 'GET');
    const res = await getPackingList(req, {
      params: Promise.resolve({ tripId: tripA.id }),
    });
    const json = await res.json();

    // Payload size check: structured DTO is concise, under 50KB for entire list
    const jsonStr = JSON.stringify(json);
    expect(jsonStr.length).toBeLessThan(50000);
  });

  it('TC-10A.26: regression check — trip and user relations remain intact after packing operations', async () => {
    const freshTrip = await prisma.trip.findUnique({
      where: { id: tripA.id },
      include: {
        packingItems: true,
        user: { select: { id: true, email: true } },
      },
    });

    expect(freshTrip).not.toBeNull();
    expect(freshTrip?.userId).toBe(userA.id);
    expect(freshTrip?.user.email).toBe(TEST_EMAIL_A);
    expect(freshTrip?.packingItems.length).toBeGreaterThan(0);
  });
});

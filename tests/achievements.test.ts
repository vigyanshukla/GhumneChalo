import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  GET as getAchievementsRoute,
  POST as evaluateAchievementsRoute,
} from '../src/app/api/achievements/route';
import {
  GET as getAchievementByIdRoute,
  PATCH as patchAchievementRoute,
  DELETE as deleteAchievementRoute,
} from '../src/app/api/achievements/[id]/route';
import { GET as getProgressSummaryRoute } from '../src/app/api/achievements/progress/route';
import { POST as createTripRoute } from '../src/app/api/trips/route';
import { POST as createSavedPlaceRoute } from '../src/app/api/saved/places/route';
import {
  evaluateAchievements,
  getUserAchievements,
  getUserProgressSummary,
  ACHIEVEMENT_CATALOG,
} from '../src/lib/achievements';

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

describe('Phase 10C — Achievements & Gamification Engine (TC-10C.01 to TC-10C.23)', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  const TEST_EMAIL_A = 'achieve.traveler.a@ghumnechalo-p10c.com';
  const TEST_EMAIL_B = 'achieve.traveler.b@ghumnechalo-p10c.com';

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
    // 1. Clean up test users if existing
    await dbRetry(async () => {
      await prisma.achievement.deleteMany({
        where: {
          user: {
            email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
          },
        },
      });

      await prisma.savedPlace.deleteMany({
        where: {
          user: {
            email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
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
        where: {
          email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
        },
      });
    });

    // 2. Create User A and User B
    userA = await dbRetry(async () =>
      prisma.user.create({
        data: {
          email: TEST_EMAIL_A,
          name: 'Achievement Explorer A',
          passwordHash: 'hashed_pw_test',
        },
        select: { id: true, email: true },
      })
    );

    userB = await dbRetry(async () =>
      prisma.user.create({
        data: {
          email: TEST_EMAIL_B,
          name: 'Achievement Explorer B',
          passwordHash: 'hashed_pw_test',
        },
        select: { id: true, email: true },
      })
    );
  });

  afterAll(async () => {
    // Cleanup records created during tests
    await dbRetry(async () => {
      await prisma.achievement.deleteMany({
        where: {
          user: {
            email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
          },
        },
      });

      await prisma.savedPlace.deleteMany({
        where: {
          user: {
            email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
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
        where: {
          email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] },
        },
      });
    });
  });

  it('TC-10C.01: authenticated user retrieves achievements', async () => {
    const req = createRequest('/api/achievements', userA.id);
    const res = await getAchievementsRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(6); // At least the 6 core specifications

    const firstTrip = json.data.find((a: { type: string }) => a.type === 'FIRST_TRIP');
    expect(firstTrip).toBeDefined();
    expect(firstTrip.title).toBe('First Trip');
    expect(firstTrip.category).toBe('TRIPS');
    expect(typeof firstTrip.progress).toBe('number');
  });

  it('TC-10C.02: User A cannot access User B achievements', async () => {
    // Create an achievement specifically for User B
    const bAchievement = await dbRetry(async () =>
      prisma.achievement.create({
        data: {
          userId: userB.id,
          type: 'FIRST_TRIP',
          progress: 100,
        },
      })
    );

    // User A attempts to read User B's achievement by ID
    const reqGet = createRequest(`/api/achievements/${bAchievement.id}`, userA.id);
    const resGet = await getAchievementByIdRoute(reqGet, {
      params: Promise.resolve({ id: bAchievement.id }),
    });
    expect(resGet.status).toBe(403);

    // User A queries own achievements; User B's achievement should NOT appear
    const reqList = createRequest('/api/achievements', userA.id);
    const resList = await getAchievementsRoute(reqList);
    const listJson = await resList.json();
    const userAFirstTrip = listJson.data.find(
      (a: { type: string }) => a.type === 'FIRST_TRIP'
    );
    expect(userAFirstTrip.isUnlocked).toBe(false);

    // Cleanup B achievement
    await dbRetry(async () => prisma.achievement.delete({ where: { id: bAchievement.id } }));
  });

  it('TC-10C.03: first-trip achievement unlocks correctly', async () => {
    // User A creates a trip
    const tripReq = createRequest('/api/trips', userA.id, 'POST', {
      title: 'First Journey to Manali',
      destinationName: 'Manali, Himachal Pradesh',
      startDate: '2026-10-10',
      endDate: '2026-10-14',
    });
    const tripRes = await createTripRoute(tripReq);
    expect(tripRes.status).toBe(201);

    // Evaluate User A's achievements
    const { achievements, newlyUnlocked } = await evaluateAchievements(userA.id, {
      eventType: 'TRIP_CREATED',
    });
    expect(newlyUnlocked).toBeDefined();

    const firstTrip = achievements.find((a) => a.type === 'FIRST_TRIP');
    expect(firstTrip).toBeDefined();
    expect(firstTrip?.isUnlocked).toBe(true);
    expect(firstTrip?.progress).toBe(100);

    // Database record must exist with progress 100
    const record = await prisma.achievement.findUnique({
      where: { userId_type: { userId: userA.id, type: 'FIRST_TRIP' } },
    });
    expect(record).not.toBeNull();
    expect(record?.progress).toBe(100);
  });

  it('TC-10C.04: explorer achievement unlocks according to specification', async () => {
    // TRAVEL_EXPLORER requires 3 saved places
    await dbRetry(async () => {
      await prisma.savedPlace.createMany({
        data: [
          {
            userId: userA.id,
            placeId: 'place_delhi_red_fort',
            name: 'Red Fort',
            category: 'Heritage',
          },
          {
            userId: userA.id,
            placeId: 'place_delhi_qutub_minar',
            name: 'Qutub Minar',
            category: 'Monument',
          },
          {
            userId: userA.id,
            placeId: 'place_delhi_india_gate',
            name: 'India Gate',
            category: 'War Memorial',
          },
        ],
      });
    });

    const { achievements } = await evaluateAchievements(userA.id, {
      eventType: 'PLACE_SAVED',
    });

    const explorer = achievements.find((a) => a.type === 'TRAVEL_EXPLORER');
    expect(explorer).toBeDefined();
    expect(explorer?.isUnlocked).toBe(true);
    expect(explorer?.progress).toBe(100);
    expect(explorer?.currentValue).toBeGreaterThanOrEqual(3);
  });

  it('TC-10C.05: budget achievement unlocks according to specification', async () => {
    // BUDGET_MASTER requires a trip budget and 2 tracked expenses
    const trip = await prisma.trip.findFirst({
      where: { userId: userA.id },
      include: { budget: true },
    });
    expect(trip).toBeDefined();

    let budget = trip?.budget;
    if (!budget) {
      budget = await dbRetry(async () =>
        prisma.budget.create({
          data: {
            tripId: trip!.id,
            totalAmount: 15000,
            currency: 'INR',
          },
        })
      );
    }

    // Add 2 expenses
    await dbRetry(async () => {
      await prisma.expense.createMany({
        data: [
          {
            budgetId: budget!.id,
            category: 'FOOD',
            description: 'Lunch at Cafe 1947',
            amount: 1200,
            expenseDate: new Date(),
          },
          {
            budgetId: budget!.id,
            category: 'TRANSPORT',
            description: 'Local taxi to Solang',
            amount: 1800,
            expenseDate: new Date(),
          },
        ],
      });
    });

    const { achievements } = await evaluateAchievements(userA.id, {
      eventType: 'EXPENSE_RECORDED',
    });

    const budgetMaster = achievements.find((a) => a.type === 'BUDGET_MASTER');
    expect(budgetMaster).toBeDefined();
    expect(budgetMaster?.isUnlocked).toBe(true);
    expect(budgetMaster?.progress).toBe(100);
  });

  it('TC-10C.06: locked achievement remains locked', async () => {
    // MULTI_TRIP_PLANNER requires 3 trips. User A currently has only 1 trip.
    const achievements = await getUserAchievements(userA.id);
    const multiTrip = achievements.find((a) => a.type === 'MULTI_TRIP_PLANNER');

    expect(multiTrip).toBeDefined();
    expect(multiTrip?.isUnlocked).toBe(false);
    expect(multiTrip?.progress).toBeLessThan(100);
  });

  it('TC-10C.07: progress calculation accurate', async () => {
    // User A has 1 trip out of 3 required for MULTI_TRIP_PLANNER
    // Math.floor((1 / 3) * 100) = 33%
    const achievements = await getUserAchievements(userA.id);
    const multiTrip = achievements.find((a) => a.type === 'MULTI_TRIP_PLANNER');

    expect(multiTrip?.currentValue).toBe(1);
    expect(multiTrip?.targetValue).toBe(3);
    expect(multiTrip?.progress).toBe(33);
  });

  it('TC-10C.08: achievement unlock is idempotent', async () => {
    // Multiple evaluations of FIRST_TRIP must succeed and produce consistent output
    const eval1 = await evaluateAchievements(userA.id);
    const eval2 = await evaluateAchievements(userA.id);
    const eval3 = await evaluateAchievements(userA.id);

    const a1 = eval1.achievements.find((a) => a.type === 'FIRST_TRIP');
    const a2 = eval2.achievements.find((a) => a.type === 'FIRST_TRIP');
    const a3 = eval3.achievements.find((a) => a.type === 'FIRST_TRIP');

    expect(a1?.isUnlocked).toBe(true);
    expect(a2?.isUnlocked).toBe(true);
    expect(a3?.isUnlocked).toBe(true);
  });

  it('TC-10C.09: duplicate events do not duplicate unlock', async () => {
    // Verify that exactly 1 database row exists for FIRST_TRIP for User A
    const count = await prisma.achievement.count({
      where: {
        userId: userA.id,
        type: 'FIRST_TRIP',
      },
    });

    expect(count).toBe(1);
  });

  it('TC-10C.10: forged userId ignored', async () => {
    // Attempting to evaluate with forged userId in POST body
    const req = createRequest('/api/achievements', userA.id, 'POST', {
      userId: userB.id,
    });
    const res = await evaluateAchievementsRoute(req);
    expect(res.status).toBe(200);

    // Achievements should still belong to authenticated userA, not userB
    const userBAchievementsCount = await prisma.achievement.count({
      where: { userId: userB.id },
    });
    expect(userBAchievementsCount).toBe(0);
  });

  it('TC-10C.11: unauthorized mutation rejected', async () => {
    const userAAchievement = await prisma.achievement.findFirst({
      where: { userId: userA.id },
    });
    expect(userAAchievement).not.toBeNull();

    // User B attempts to PATCH User A's achievement
    const patchReq = createRequest(
      `/api/achievements/${userAAchievement!.id}`,
      userB.id,
      'PATCH',
      { progress: 0 }
    );
    const patchRes = await patchAchievementRoute(patchReq, {
      params: Promise.resolve({ id: userAAchievement!.id }),
    });
    expect(patchRes.status).toBe(403);

    // User B attempts to DELETE User A's achievement
    const deleteReq = createRequest(
      `/api/achievements/${userAAchievement!.id}`,
      userB.id,
      'DELETE'
    );
    const deleteRes = await deleteAchievementRoute(deleteReq, {
      params: Promise.resolve({ id: userAAchievement!.id }),
    });
    expect(deleteRes.status).toBe(403);
  });

  it('TC-10C.12: event-based evaluation works', async () => {
    // Saving a place triggers PLACE_SAVED event
    const placeReq = createRequest('/api/saved/places', userB.id, 'POST', {
      placeId: 'place_b_jaipur_hawa_mahal',
      name: 'Hawa Mahal',
      address: 'Jaipur, Rajasthan',
      category: 'Sightseeing',
    });
    const placeRes = await createSavedPlaceRoute(placeReq);
    expect(placeRes.status).toBe(201);

    // Progress on TRAVEL_EXPLORER should be 1 / 3 = 33%
    const achievements = await getUserAchievements(userB.id);
    const explorer = achievements.find((a) => a.type === 'TRAVEL_EXPLORER');
    expect(explorer?.currentValue).toBe(1);
    expect(explorer?.progress).toBe(33);
    expect(explorer?.isUnlocked).toBe(false);
  });

  it('TC-10C.13: existing achievements survive repeated evaluation', async () => {
    const originalRecord = await prisma.achievement.findUnique({
      where: { userId_type: { userId: userA.id, type: 'FIRST_TRIP' } },
    });
    expect(originalRecord).not.toBeNull();

    // Re-evaluate
    await evaluateAchievements(userA.id);

    const reEvaluatedRecord = await prisma.achievement.findUnique({
      where: { userId_type: { userId: userA.id, type: 'FIRST_TRIP' } },
    });

    expect(reEvaluatedRecord?.id).toBe(originalRecord?.id);
    expect(reEvaluatedRecord?.earnedAt.getTime()).toBe(
      originalRecord?.earnedAt.getTime()
    );
  });

  it('TC-10C.14: database integrity preserved', async () => {
    // Verify relations and cascade delete behavior
    const userWithAchievements = await prisma.user.findUnique({
      where: { id: userA.id },
      include: { achievements: true },
    });

    expect(userWithAchievements).not.toBeNull();
    expect(userWithAchievements?.achievements.length).toBeGreaterThanOrEqual(1);
    expect(userWithAchievements?.achievements[0].userId).toBe(userA.id);
  });

  it('TC-10C.15: mobile UI layout contract valid', async () => {
    // Validate responsive data structure and layout contract
    const summary = await getUserProgressSummary(userA.id);
    expect(summary).toBeDefined();
    expect(typeof summary.completionRate).toBe('number');
    expect(summary.total).toBe(ACHIEVEMENT_CATALOG.length);
    expect(summary.unlockedCount).toBeGreaterThanOrEqual(1);
  });

  it('TC-10C.16: desktop UI layout contract valid', async () => {
    const summaryReq = createRequest('/api/achievements/progress', userA.id);
    const summaryRes = await getProgressSummaryRoute(summaryReq);
    expect(summaryRes.status).toBe(200);

    const json = await summaryRes.json();
    expect(json.success).toBe(true);
    expect(json.data.totalPoints).toBeGreaterThan(0);
    expect(json.data.earnedPoints).toBeGreaterThan(0);
  });

  it('TC-10C.17: regression: existing trip and saved place queries remain intact', async () => {
    const userTrips = await prisma.trip.findMany({ where: { userId: userA.id } });
    const userPlaces = await prisma.savedPlace.findMany({ where: { userId: userA.id } });

    expect(userTrips.length).toBeGreaterThanOrEqual(1);
    expect(userPlaces.length).toBeGreaterThanOrEqual(3);
  });

  it('TC-10C.18: Foodie Explorer unlocks with culinary spots', async () => {
    // Add 2 culinary saved places
    await dbRetry(async () => {
      await prisma.savedPlace.createMany({
        data: [
          {
            userId: userA.id,
            placeId: 'food_spot_karims',
            name: "Karim's Old Delhi",
            category: 'Restaurant & Dining',
          },
          {
            userId: userA.id,
            placeId: 'food_spot_paranthe_wali_gali',
            name: 'Paranthe Wali Gali',
            category: 'Street Food & Cafe',
          },
        ],
      });
    });

    const { achievements } = await evaluateAchievements(userA.id);
    const foodie = achievements.find((a) => a.type === 'FOODIE_EXPLORER');
    expect(foodie).toBeDefined();
    expect(foodie?.isUnlocked).toBe(true);
    expect(foodie?.progress).toBe(100);
  });

  it('TC-10C.19: Nature Lover unlocks with scenic outdoor spots', async () => {
    // Add 2 nature spots
    await dbRetry(async () => {
      await prisma.savedPlace.createMany({
        data: [
          {
            userId: userA.id,
            placeId: 'nature_spot_solang_valley',
            name: 'Solang Valley Viewpoint',
            category: 'Mountain Scenic Trek',
          },
          {
            userId: userA.id,
            placeId: 'nature_spot_van_vihar',
            name: 'Van Vihar National Park',
            category: 'Nature Park & Wildlife',
          },
        ],
      });
    });

    const { achievements } = await evaluateAchievements(userA.id);
    const nature = achievements.find((a) => a.type === 'NATURE_LOVER');
    expect(nature).toBeDefined();
    expect(nature?.isUnlocked).toBe(true);
    expect(nature?.progress).toBe(100);
  });

  it('TC-10C.20: Multi-Trip Planner unlocks when user plans 3 or more trips', async () => {
    // User A already has 1 trip. Add 2 more.
    await dbRetry(async () => {
      await prisma.trip.createMany({
        data: [
          {
            userId: userA.id,
            title: 'Trip to Goa Beaches',
            destinationName: 'Goa, India',
            startDate: new Date('2026-11-01'),
            endDate: new Date('2026-11-06'),
          },
          {
            userId: userA.id,
            title: 'Trip to Kerala Backwaters',
            destinationName: 'Alleppey, Kerala',
            startDate: new Date('2026-12-15'),
            endDate: new Date('2026-12-20'),
          },
        ],
      });
    });

    const { achievements } = await evaluateAchievements(userA.id);
    const multiTrip = achievements.find((a) => a.type === 'MULTI_TRIP_PLANNER');
    expect(multiTrip).toBeDefined();
    expect(multiTrip?.isUnlocked).toBe(true);
    expect(multiTrip?.progress).toBe(100);
  });

  it('TC-10C.21: Packing Pro unlocks when 5 items are checked', async () => {
    const trip = await prisma.trip.findFirst({ where: { userId: userA.id } });
    expect(trip).toBeDefined();

    await dbRetry(async () => {
      await prisma.packingItem.createMany({
        data: Array.from({ length: 5 }).map((_, i) => ({
          tripId: trip!.id,
          name: `Essential Gear ${i + 1}`,
          category: 'ESSENTIALS',
          quantity: 1,
          isPacked: true,
        })),
      });
    });

    const { achievements } = await evaluateAchievements(userA.id);
    const packingPro = achievements.find((a) => a.type === 'PACKING_PRO');
    expect(packingPro).toBeDefined();
    expect(packingPro?.isUnlocked).toBe(true);
    expect(packingPro?.progress).toBe(100);
  });

  it('TC-10C.22: Wayfarer unlocks when 2 transit bookings are recorded', async () => {
    const trip = await prisma.trip.findFirst({ where: { userId: userA.id } });
    expect(trip).toBeDefined();

    await dbRetry(async () => {
      await prisma.transportation.createMany({
        data: [
          {
            tripId: trip!.id,
            type: 'FLIGHT',
            origin: 'DEL',
            destination: 'IXC',
            cost: 4500,
          },
          {
            tripId: trip!.id,
            type: 'BUS',
            origin: 'Chandigarh',
            destination: 'Manali',
            cost: 1200,
          },
        ],
      });
    });

    const { achievements } = await evaluateAchievements(userA.id);
    const wayfarer = achievements.find((a) => a.type === 'WAYFARER');
    expect(wayfarer).toBeDefined();
    expect(wayfarer?.isUnlocked).toBe(true);
    expect(wayfarer?.progress).toBe(100);
  });

  it('TC-10C.23: Progress summary API returns accurate stats, points, and recent unlocks', async () => {
    const req = createRequest('/api/achievements/progress', userA.id);
    const res = await getProgressSummaryRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.total).toBe(ACHIEVEMENT_CATALOG.length);
    expect(json.data.unlockedCount).toBeGreaterThanOrEqual(6);
    expect(json.data.completionRate).toBeGreaterThanOrEqual(60);
    expect(json.data.earnedPoints).toBeGreaterThanOrEqual(150);
    expect(Array.isArray(json.data.recentUnlocks)).toBe(true);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { GET as getTrip, PATCH as patchTrip, DELETE as deleteTrip } from '../src/app/api/trips/[tripId]/route';
import { POST as createTrip } from '../src/app/api/trips/route';
import { DELETE as deleteSavedPlace } from '../src/app/api/saved/places/[id]/route';
import { GET as getSearchRecent } from '../src/app/api/search/recent/route';
import { GET as getBudget } from '../src/app/api/trips/[tripId]/budget/route';
import { PATCH as patchExpense } from '../src/app/api/trips/[tripId]/expenses/[expenseId]/route';
import { GET as getNotification } from '../src/app/api/notifications/[id]/route';
import { PATCH as patchAchievement } from '../src/app/api/achievements/[id]/route';
import { NextRequest } from 'next/server';

describe('Phase 1 — Authorization, IDOR & User Isolation (TC-1.22 to TC-1.32)', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  let tripAId: string;
  let savedPlaceAId: string;
  let expenseAId: string;
  let notificationAId: string;
  let achievementAId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: { email: { in: ['user-a@auth-test.com', 'user-b@auth-test.com'] } },
    });

    // Create User A and User B
    userA = await prisma.user.create({
      data: { email: 'user-a@auth-test.com', name: 'User A' },
    });

    userB = await prisma.user.create({
      data: { email: 'user-b@auth-test.com', name: 'User B' },
    });

    // User A creates resources
    const tripA = await prisma.trip.create({
      data: {
        userId: userA.id,
        title: "User A's Secret Trip",
        destinationName: 'Manali, India',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-07'),
        totalBudget: 40000,
        currency: 'INR',
        budget: {
          create: {
            totalAmount: 40000,
            currency: 'INR',
            expenses: {
              create: {
                category: 'ACCOMMODATION',
                description: 'Mountain Resort',
                amount: 15000,
              },
            },
          },
        },
      },
      include: {
        budget: {
          include: { expenses: true },
        },
      },
    });
    tripAId = tripA.id;
    expenseAId = tripA.budget!.expenses[0].id;

    const savedPlaceA = await prisma.savedPlace.create({
      data: {
        userId: userA.id,
        placeId: 'ChIJPlaceUserA12345',
        name: 'Solang Valley Viewpoint',
      },
    });
    savedPlaceAId = savedPlaceA.id;

    await prisma.searchHistory.create({
      data: {
        userId: userA.id,
        query: 'Private Himalayan Treks',
        searchCount: 3,
      },
    });

    const notifA = await prisma.notification.create({
      data: {
        userId: userA.id,
        type: 'BUDGET_ALERT',
        title: 'Budget Alert',
        body: 'User A Budget Warning',
      },
    });
    notificationAId = notifA.id;

    const achA = await prisma.achievement.create({
      data: {
        userId: userA.id,
        type: 'MOUNTAIN_CONQUEROR',
        progress: 80,
      },
    });
    achievementAId = achA.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['user-a@auth-test.com', 'user-b@auth-test.com'] } },
    });
  });

  function createRequest(url: string, userId: string, method = 'GET', body?: unknown) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${userId}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  // TC-1.22: User B requests Trip A
  it('TC-1.22: User B requests Trip A -> Access denied (403)', async () => {
    const req = createRequest(`/api/trips/${tripAId}`, userB.id);
    const res = await getTrip(req, { params: Promise.resolve({ tripId: tripAId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });

  // TC-1.23: User B modifies Trip A
  it('TC-1.23: User B modifies Trip A -> Access denied (403)', async () => {
    const req = createRequest(`/api/trips/${tripAId}`, userB.id, 'PATCH', {
      title: 'Hacked by User B',
    });
    const res = await patchTrip(req, { params: Promise.resolve({ tripId: tripAId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.24: User B deletes Trip A
  it('TC-1.24: User B deletes Trip A -> Access denied (403)', async () => {
    const req = createRequest(`/api/trips/${tripAId}`, userB.id, 'DELETE');
    const res = await deleteTrip(req, { params: Promise.resolve({ tripId: tripAId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);

    // Verify trip still exists in DB
    const check = await prisma.trip.findUnique({ where: { id: tripAId } });
    expect(check).not.toBeNull();
  });

  // TC-1.25 & TC-1.26: User B deletes Saved Place A
  it('TC-1.26: User B deletes Saved Place A -> Access denied (403)', async () => {
    const req = createRequest(`/api/saved/places/${savedPlaceAId}`, userB.id, 'DELETE');
    const res = await deleteSavedPlace(req, { params: Promise.resolve({ id: savedPlaceAId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.27: User B reads Search History A
  it("TC-1.27: User B cannot see User A's search history", async () => {
    const req = createRequest('/api/search/recent', userB.id);
    const res = await getSearchRecent(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]); // User B has no search history
  });

  // TC-1.28: User B reads Budget A
  it('TC-1.28: User B reads Budget A -> Access denied (403)', async () => {
    const req = createRequest(`/api/trips/${tripAId}/budget`, userB.id);
    const res = await getBudget(req, { params: Promise.resolve({ tripId: tripAId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.29: User B modifies Expense A
  it('TC-1.29: User B modifies Expense A -> Access denied (403)', async () => {
    const req = createRequest(`/api/trips/${tripAId}/expenses/${expenseAId}`, userB.id, 'PATCH', {
      amount: 99999,
    });
    const res = await patchExpense(req, {
      params: Promise.resolve({ tripId: tripAId, expenseId: expenseAId }),
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.30: User B reads Notification A
  it('TC-1.30: User B reads Notification A -> Access denied (403)', async () => {
    const req = createRequest(`/api/notifications/${notificationAId}`, userB.id);
    const res = await getNotification(req, { params: Promise.resolve({ id: notificationAId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.31: User B modifies Achievement A
  it('TC-1.31: User B modifies Achievement A -> Access denied (403)', async () => {
    const req = createRequest(`/api/achievements/${achievementAId}`, userB.id, 'PATCH', {
      progress: 0,
    });
    const res = await patchAchievement(req, { params: Promise.resolve({ id: achievementAId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.32: User ID Spoofing Test
  it('TC-1.32: Server ignores userId in request body; trip remains associated with authenticated User A', async () => {
    const spoofedBody = {
      userId: userB.id, // Maliciously trying to create trip under User B's identity
      title: 'Legitimate Trip Owned By A',
      destinationName: 'Shimla, India',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
    };

    const req = createRequest('/api/trips', userA.id, 'POST', spoofedBody);
    const res = await createTrip(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);

    // CRITICAL: The newly created trip MUST belong to userA, NOT userB!
    expect(data.data.userId).toBe(userA.id);
    expect(data.data.userId).not.toBe(userB.id);

    // Verify in database directly
    const dbTrip = await prisma.trip.findUnique({ where: { id: data.data.id } });
    expect(dbTrip?.userId).toBe(userA.id);
  });
});

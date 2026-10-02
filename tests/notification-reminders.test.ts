import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  evaluateTripReminders,
  evaluateItineraryReminders,
  evaluateTransportationReminders,
  evaluateWeatherAlerts,
  evaluateBudgetAlerts,
  formatDateInTimezone,
} from '../src/lib/notifications/reminder-engine';
import {
  createNotification,
  updateUserPreferences,
  getUserNotifications,
} from '../src/lib/notifications';
import { POST as evaluateRemindersRoute } from '../src/app/api/notifications/reminders/evaluate/route';
import {
  POST as postCronRoute,
  GET as getCronRoute,
} from '../src/app/api/cron/reminders/route';

function createRequest(
  url: string,
  userId?: string,
  method = 'GET',
  body?: unknown,
  extraHeaders?: Record<string, string>
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: {
      'content-type': 'application/json',
      ...(userId ? { authorization: `Bearer ${userId}` } : {}),
      ...(extraHeaders || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Phase 11B — Travel Reminder & Event Notification Engine (TC-11B.01 to TC-11B.15)', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  const runId = Math.random().toString(36).substring(2, 9);
  const TEST_EMAIL_A = `reminder.traveler.a.${runId}@p11b.com`;
  const TEST_EMAIL_B = `reminder.traveler.b.${runId}@p11b.com`;

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
    // Clean up any stale records from old static emails
    await dbRetry(async () => {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              'reminder.traveler.a@ghumnechalo-p11b.com',
              'reminder.traveler.b@ghumnechalo-p11b.com',
            ],
          },
        },
      });
    });

    userA = await dbRetry(() =>
      prisma.user.create({
        data: { email: TEST_EMAIL_A, name: 'Reminder Traveler A' },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: { email: TEST_EMAIL_B, name: 'Reminder Traveler B' },
      })
    );
  });

  afterAll(async () => {
    const uIds = [userA?.id, userB?.id].filter(Boolean);
    if (uIds.length > 0) {
      await dbRetry(async () => {
        await prisma.user.deleteMany({ where: { id: { in: uIds } } });
      });
    }
  });

  // TC-11B.01: Upcoming trip reminder generated correctly
  it('TC-11B.01: upcoming trip reminder generated correctly', async () => {
    const now = new Date();
    const tripStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const tripEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const trip = await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Upcoming Kerala Escape',
          destinationName: 'Munnar, Kerala',
          startDate: tripStart,
          endDate: tripEnd,
        },
      })
    );

    const results = await evaluateTripReminders(userA.id, { referenceTime: now });
    expect(results.length).toBeGreaterThanOrEqual(1);

    const match = results.find((r) => r.notification?.title.includes('Upcoming Kerala Escape'));
    expect(match).toBeDefined();
    expect(match?.created).toBe(true);
    expect(match?.notification?.type).toBe('TRIP_UPCOMING');
    expect(match?.notification?.actionUrl).toBe(`/trips/${trip.id}`);
  });

  // TC-11B.02: Duplicate trip reminder prevented
  it('TC-11B.02: duplicate trip reminder prevented', async () => {
    const now = new Date();

    // Call evaluateTripReminders again for user A
    const results = await evaluateTripReminders(userA.id, { referenceTime: now });
    const match = results.find((r) => r.notification?.title.includes('Upcoming Kerala Escape'));

    expect(match).toBeDefined();
    expect(match?.created).toBe(false);
    expect(match?.duplicate).toBe(true);

    // Verify DB count
    const count = await prisma.notification.count({
      where: {
        userId: userA.id,
        type: 'TRIP_UPCOMING',
        title: { contains: 'Upcoming Kerala Escape' },
      },
    });
    expect(count).toBe(1);
  });

  // TC-11B.03: Itinerary reminder generated correctly
  it('TC-11B.03: itinerary reminder generated correctly', async () => {
    const now = new Date();
    const trip = await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Jaipur Heritage Tour',
          destinationName: 'Jaipur, Rajasthan',
          startDate: now,
          endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          itineraryDays: {
            create: {
              dayNumber: 1,
              date: now,
              title: 'Forts Exploration',
              items: {
                create: {
                  name: 'Amber Fort Elephant Viewpoint',
                  startTime: '09:00',
                  order: 1,
                },
              },
            },
          },
        },
      })
    );

    const results = await evaluateItineraryReminders(userA.id, { referenceTime: now });
    const match = results.find((r) =>
      r.notification?.title.includes('Amber Fort Elephant Viewpoint')
    );

    expect(match).toBeDefined();
    expect(match?.created).toBe(true);
    expect(match?.notification?.type).toBe('ITINERARY_UPCOMING');
    expect(match?.notification?.actionUrl).toBe(`/trips/${trip.id}`);
  });

  // TC-11B.04: Transportation reminder generated correctly
  it('TC-11B.04: transportation reminder generated correctly', async () => {
    const now = new Date();
    const departure = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now

    const trip = await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Goa Coastal Getaway',
          destinationName: 'Goa',
          startDate: now,
          endDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
          transportation: {
            create: {
              type: 'FLIGHT',
              origin: 'DEL',
              destination: 'GOI',
              departureTime: departure,
            },
          },
        },
      })
    );

    const results = await evaluateTransportationReminders(userA.id, { referenceTime: now });
    const match = results.find((r) => r.notification?.title.includes('FLIGHT Departure: DEL → GOI'));

    expect(match).toBeDefined();
    expect(match?.created).toBe(true);
    expect(match?.notification?.type).toBe('TRANSPORT_DEPARTURE');
    expect(match?.notification?.actionUrl).toBe(`/trips/${trip.id}`);
  });

  // TC-11B.05: User preference disables reminder
  it('TC-11B.05: user preference disables reminder', async () => {
    // Disable transportationReminders in user A preferences
    await updateUserPreferences(userA.id, {
      transportationReminders: false,
    });

    const now = new Date();
    const results = await evaluateTransportationReminders(userA.id, { referenceTime: now });
    for (const r of results) {
      expect(r.created).toBe(false);
      expect(r.reason).toBe('CATEGORY_DISABLED');
    }

    // Re-enable for subsequent tests
    await updateUserPreferences(userA.id, {
      transportationReminders: true,
    });
  });

  // TC-11B.06: User A cannot generate/read user B reminder
  it('TC-11B.06: user A cannot generate/read user B reminder', async () => {
    // Evaluate reminders for User A using User A's session
    const req = createRequest('/api/notifications/reminders/evaluate', userA.id, 'POST');
    const res = await evaluateRemindersRoute(req);
    expect(res.status).toBe(200);

    // Fetch user A notifications
    const aList = await getUserNotifications(userA.id);
    for (const n of aList.notifications) {
      expect(n.userId).toBe(userA.id);
      expect(n.userId).not.toBe(userB.id);
    }
  });

  // TC-11B.07: Timezone handling correct
  it('TC-11B.07: timezone handling correct', () => {
    const fixedDate = new Date('2026-10-15T08:30:00.000Z');

    const istString = formatDateInTimezone(fixedDate, 'Asia/Kolkata');
    const nyString = formatDateInTimezone(fixedDate, 'America/New_York');

    expect(istString).toBeDefined();
    expect(nyString).toBeDefined();
    expect(istString).not.toEqual(nyString); // 5.5 hours ahead vs 4 hours behind
  });

  // TC-11B.08: Midnight/date-boundary handling correct
  it('TC-11B.08: midnight/date-boundary handling correct', async () => {
    // Event at 23:59:59
    const midnightEdge = new Date('2026-11-20T23:59:59.000Z');
    await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Midnight Crossing',
          destinationName: 'Manali',
          startDate: midnightEdge,
          endDate: new Date('2026-11-25T10:00:00.000Z'),
        },
      })
    );

    // Evaluating 2 hours before midnight
    const refTime = new Date('2026-11-20T22:00:00.000Z');
    const results = await evaluateTripReminders(userA.id, { referenceTime: refTime });
    const match = results.find((r) => r.notification?.title.includes('Midnight Crossing'));

    expect(match).toBeDefined();
    expect(match?.created).toBe(true);
  });

  // TC-11B.09: Expired/past events do not generate invalid reminders
  it('TC-11B.09: expired/past events do not generate invalid reminders', async () => {
    // Trip completed 1 month ago
    await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Completed Ancient Trip',
          destinationName: 'Hampi',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-05T00:00:00.000Z'),
        },
      })
    );

    const now = new Date();
    const results = await evaluateTripReminders(userA.id, { referenceTime: now });
    const match = results.find((r) => r.notification?.title.includes('Completed Ancient Trip'));
    expect(match).toBeUndefined();
  });

  // TC-11B.10: Achievement notification generated once
  it('TC-11B.10: achievement notification generated once', async () => {
    const key = `ACHIEVEMENT_UNLOCKED:${userA.id}:first-trip`;

    const res1 = await createNotification(userA.id, {
      type: 'ACHIEVEMENT_UNLOCKED',
      title: '🏆 Achievement Unlocked: First Wander!',
      body: 'You created your first itinerary on GhumneChalo.',
      idempotencyKey: key,
    });
    expect(res1.created).toBe(true);

    const res2 = await createNotification(userA.id, {
      type: 'ACHIEVEMENT_UNLOCKED',
      title: '🏆 Achievement Unlocked: First Wander! (Repeat)',
      body: 'You created your first itinerary on GhumneChalo.',
      idempotencyKey: key,
    });
    expect(res2.created).toBe(false);
    expect(res2.duplicate).toBe(true);
  });

  // TC-11B.11: Budget notification respects configured threshold
  it('TC-11B.11: budget notification respects configured threshold', async () => {
    // 1. Create trip with budget 10,000 and expenses 8,500 (85%)
    await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Varanasi Spiritual Tour',
          destinationName: 'Varanasi',
          startDate: new Date(),
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          budget: {
            create: {
              totalAmount: 10000,
              currency: 'INR',
              expenses: {
                createMany: {
                  data: [
                    { amount: 5000, description: 'Ghat Hotel Stay' },
                    { amount: 3500, description: 'Boat & Guide' },
                  ],
                },
              },
            },
          },
        },
      })
    );

    const results = await evaluateBudgetAlerts(userA.id);
    const match = results.find((r) => r.notification?.title.includes('Varanasi Spiritual Tour'));

    expect(match).toBeDefined();
    expect(match?.created).toBe(true);
    expect(match?.notification?.type).toBe('BUDGET_ALERT');
    expect(match?.notification?.body).toContain('85%');
  });

  // TC-11B.12: Weather notification only generated when valid weather data exists
  it('TC-11B.12: weather notification only generated when valid weather data exists', async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // Trip with severe rain (85% precipitation)
    await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Rishikesh Adventure',
          destinationName: 'Rishikesh, Uttarakhand',
          startDate: now,
          endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          weatherSnapshots: {
            create: {
              date: futureDate,
              latitude: 30.0869,
              longitude: 78.2676,
              temperature: 24,
              precipitationProbability: 85,
            },
          },
        },
      })
    );

    const results = await evaluateWeatherAlerts(userA.id, { referenceTime: now });
    const match = results.find((r) => r.notification?.title.includes('Rishikesh, Uttarakhand'));

    expect(match).toBeDefined();
    expect(match?.created).toBe(true);
    expect(match?.notification?.body).toContain('Heavy Rain Expected');
  });

  // TC-11B.13: Retry does not create duplicate notifications
  it('TC-11B.13: retry does not create duplicate notifications', async () => {
    await evaluateTripReminders(userA.id);
    const countAfterFirst = (await getUserNotifications(userA.id)).total;

    const res2 = await evaluateTripReminders(userA.id);
    const countAfterSecond = (await getUserNotifications(userA.id)).total;

    expect(countAfterSecond).toBe(countAfterFirst);
    expect(res2.filter((r) => r.created).length).toBe(0);
  });

  // TC-11B.14: Scheduled trigger requires secure authorization
  it('TC-11B.14: scheduled trigger requires secure authorization', async () => {
    // 1. Without authorization header -> 401
    const unauthReq = createRequest('/api/cron/reminders', undefined, 'POST', {});
    const unauthRes = await postCronRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. With invalid authorization header -> 401
    const badReq = createRequest('/api/cron/reminders', undefined, 'POST', {}, {
      authorization: 'Bearer wrong-secret-token',
    });
    const badRes = await postCronRoute(badReq);
    expect(badRes.status).toBe(401);

    // 3. With valid secret -> 200
    const validSecret = process.env.CRON_SECRET || 'ghumnechalo-cron-secret-2026';
    const validReq = createRequest('/api/cron/reminders?limit=1', undefined, 'POST', {}, {
      authorization: `Bearer ${validSecret}`,
    });
    const validRes = await postCronRoute(validReq);
    expect(validRes.status).toBe(200);

    const data = await validRes.json();
    expect(data.success).toBe(true);
    expect(data.data.success).toBe(true);

    // 4. Test GET method for Vercel Cron
    const getReq = createRequest('/api/cron/reminders?limit=1', undefined, 'GET', undefined, {
      authorization: `Bearer ${validSecret}`,
    });
    const getRes = await getCronRoute(getReq);
    expect(getRes.status).toBe(200);
  });

  // TC-11B.15: Malformed event data safely rejected
  it('TC-11B.15: malformed event data safely rejected', async () => {
    // Missing title or invalid notification type
    await expect(
      createNotification(userA.id, {
        type: 'INVALID_TYPE' as unknown as 'SYSTEM',
        title: 'Title',
        body: 'Body',
      })
    ).rejects.toThrow();
  });
});

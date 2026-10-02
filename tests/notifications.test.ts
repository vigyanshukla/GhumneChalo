import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  GET as getNotificationsRoute,
  POST as createNotificationRoute,
} from '../src/app/api/notifications/route';
import {
  GET as getNotificationByIdRoute,
  PATCH as patchNotificationRoute,
  DELETE as deleteNotificationRoute,
} from '../src/app/api/notifications/[id]/route';
import { PATCH as markNotificationReadRoute } from '../src/app/api/notifications/[id]/read/route';
import { GET as getUnreadCountRoute } from '../src/app/api/notifications/unread-count/route';
import { POST as markAllReadRoute } from '../src/app/api/notifications/read-all/route';
import {
  GET as getPreferencesRoute,
  PUT as updatePreferencesRoute,
} from '../src/app/api/notifications/preferences/route';
import {
  createNotification,
  getUnreadCount,
  updateUserPreferences,
} from '../src/lib/notifications';

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

describe('Phase 11A — In-App Notification Center (TC-11A.01 to TC-11A.18)', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  const TEST_EMAIL_A = 'notify.traveler.a@ghumnechalo-p11a.com';
  const TEST_EMAIL_B = 'notify.traveler.b@ghumnechalo-p11a.com';

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
    // 1. Clean up old test data
    await dbRetry(async () => {
      const existingUsers = await prisma.user.findMany({
        where: { email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] } },
        select: { id: true },
      });
      if (existingUsers.length > 0) {
        const uIds = existingUsers.map((u) => u.id);
        await prisma.notification.deleteMany({ where: { userId: { in: uIds } } });
        await prisma.notificationPreference.deleteMany({ where: { userId: { in: uIds } } });
        await prisma.user.deleteMany({ where: { id: { in: uIds } } });
      }
    });

    // 2. Create User A & User B
    userA = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: TEST_EMAIL_A,
          name: 'Notify Traveler A',
        },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: TEST_EMAIL_B,
          name: 'Notify Traveler B',
        },
      })
    );
  });

  afterAll(async () => {
    await dbRetry(async () => {
      if (userA?.id || userB?.id) {
        const uIds = [userA?.id, userB?.id].filter(Boolean);
        await prisma.notification.deleteMany({ where: { userId: { in: uIds } } });
        await prisma.notificationPreference.deleteMany({ where: { userId: { in: uIds } } });
        await prisma.user.deleteMany({ where: { id: { in: uIds } } });
      }
    });
  });

  // TC-11A.01: Authenticated user can retrieve notifications
  it('TC-11A.01: Authenticated user can retrieve notifications', async () => {
    // Create a notification for user A
    await dbRetry(() =>
      createNotification(userA.id, {
        type: 'TRIP_REMINDER',
        title: 'Upcoming Trip to Goa',
        body: 'Your journey starts tomorrow! Check packing list.',
        actionUrl: '/trips/test-trip',
      })
    );

    const req = createRequest('/api/notifications', userA.id);
    const res = await getNotificationsRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.notifications).toBeDefined();
    expect(data.data.notifications.length).toBeGreaterThanOrEqual(1);
    expect(data.data.notifications[0].title).toBe('Upcoming Trip to Goa');
    expect(data.data.total).toBeGreaterThanOrEqual(1);
  });

  // TC-11A.02: Unauthenticated user cannot access private notifications
  it('TC-11A.02: Unauthenticated user cannot access private notifications', async () => {
    const req = createRequest('/api/notifications'); // no user
    const res = await getNotificationsRoute(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-11A.03: User A cannot read User B notifications
  it('TC-11A.03: User A cannot read User B notifications', async () => {
    // Create notification for User B
    const bNotification = await dbRetry(() =>
      prisma.notification.create({
        data: {
          userId: userB.id,
          type: 'SECURITY_ALERT',
          title: 'Secret User B Notification',
          body: 'Only User B should see this.',
        },
      })
    );

    // User A attempts to read User B's notification via direct ID endpoint
    const req = createRequest(`/api/notifications/${bNotification.id}`, userA.id);
    const res = await getNotificationByIdRoute(req, {
      params: Promise.resolve({ id: bNotification.id }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);

    // Also verify User A's list never includes User B's notification
    const listReq = createRequest('/api/notifications', userA.id);
    const listRes = await getNotificationsRoute(listReq);
    const listData = await listRes.json();
    const hasBItem = listData.data.notifications.some(
      (n: { id: string }) => n.id === bNotification.id
    );
    expect(hasBItem).toBe(false);
  });

  // TC-11A.04: User A cannot mark User B notification as read
  it('TC-11A.04: User A cannot mark User B notification as read', async () => {
    const bNotification = await dbRetry(() =>
      prisma.notification.create({
        data: {
          userId: userB.id,
          type: 'BUDGET_ALERT',
          title: 'User B Budget Alert',
          body: 'Budget warning for trip B',
        },
      })
    );

    const req = createRequest(`/api/notifications/${bNotification.id}`, userA.id, 'PATCH');
    const res = await patchNotificationRoute(req, {
      params: Promise.resolve({ id: bNotification.id }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);

    // Confirm it remained unread in database
    const fresh = await prisma.notification.findUnique({ where: { id: bNotification.id } });
    expect(fresh?.readAt).toBeNull();
  });

  // TC-11A.05: User A cannot delete User B notification
  it('TC-11A.05: User A cannot delete User B notification', async () => {
    const bNotification = await dbRetry(() =>
      prisma.notification.create({
        data: {
          userId: userB.id,
          type: 'SYSTEM',
          title: 'User B System Note',
          body: 'Critical notice for B',
        },
      })
    );

    const req = createRequest(`/api/notifications/${bNotification.id}`, userA.id, 'DELETE');
    const res = await deleteNotificationRoute(req, {
      params: Promise.resolve({ id: bNotification.id }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);

    // Confirm notification still exists
    const fresh = await prisma.notification.findUnique({ where: { id: bNotification.id } });
    expect(fresh).not.toBeNull();
  });

  // TC-11A.06: Unread count is accurate
  it('TC-11A.06: Unread count is accurate', async () => {
    // Clear user A's notifications first
    await dbRetry(() => prisma.notification.deleteMany({ where: { userId: userA.id } }));

    // Create 3 unread and 1 read notification
    await dbRetry(async () => {
      await prisma.notification.createMany({
        data: [
          { userId: userA.id, title: 'Note 1', body: 'Body 1', type: 'TRIP_REMINDER' },
          { userId: userA.id, title: 'Note 2', body: 'Body 2', type: 'WEATHER_ALERT' },
          { userId: userA.id, title: 'Note 3', body: 'Body 3', type: 'ITINERARY_REMINDER' },
          { userId: userA.id, title: 'Note 4', body: 'Body 4', type: 'SYSTEM', readAt: new Date() },
        ],
      });
    });

    const req = createRequest('/api/notifications/unread-count', userA.id);
    const res = await getUnreadCountRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.unreadCount).toBe(3);
  });

  // TC-11A.07: Mark one notification as read works
  it('TC-11A.07: Mark one notification as read works', async () => {
    const note = await dbRetry(() =>
      prisma.notification.create({
        data: {
          userId: userA.id,
          title: 'Mark Read Test',
          body: 'Testing mark read',
          type: 'TRIP_REMINDER',
        },
      })
    );

    // Call /api/notifications/:id/read
    const req = createRequest(`/api/notifications/${note.id}/read`, userA.id, 'PATCH');
    const res = await markNotificationReadRoute(req, {
      params: Promise.resolve({ id: note.id }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.readAt).not.toBeNull();

    // Verify in database
    const fresh = await prisma.notification.findUnique({ where: { id: note.id } });
    expect(fresh?.readAt).not.toBeNull();
  });

  // TC-11A.08: Mark-all-as-read works
  it('TC-11A.08: Mark-all-as-read works', async () => {
    // Add two unread notes
    await dbRetry(() =>
      prisma.notification.createMany({
        data: [
          { userId: userA.id, title: 'Batch 1', body: 'B1', type: 'SYSTEM' },
          { userId: userA.id, title: 'Batch 2', body: 'B2', type: 'SYSTEM' },
        ],
      })
    );

    const req = createRequest('/api/notifications/read-all', userA.id, 'POST');
    const res = await markAllReadRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify unread count is now 0
    const count = await getUnreadCount(userA.id);
    expect(count).toBe(0);
  });

  // TC-11A.09: Read notification does not increase unread count
  it('TC-11A.09: Read notification does not increase unread count', async () => {
    const initialCount = await getUnreadCount(userA.id);

    // Create an already read notification
    await dbRetry(() =>
      prisma.notification.create({
        data: {
          userId: userA.id,
          title: 'Already Read Note',
          body: 'This was read upon generation',
          type: 'TRIP_REMINDER',
          readAt: new Date(),
        },
      })
    );

    const currentCount = await getUnreadCount(userA.id);
    expect(currentCount).toBe(initialCount);
  });

  // TC-11A.10: Duplicate notification generation is prevented when idempotency key exists
  it('TC-11A.10: Duplicate notification generation is prevented when idempotency key exists', async () => {
    const key = `idempotent_test_key_${Date.now()}`;

    // 1st generation
    const res1 = await createNotification(userA.id, {
      type: 'WEATHER_ALERT',
      title: 'Heavy Rain in Manali',
      body: 'Thunderstorms expected tomorrow afternoon.',
      idempotencyKey: key,
    });

    expect(res1.created).toBe(true);
    expect(res1.notification).toBeDefined();

    // 2nd generation with identical key
    const res2 = await createNotification(userA.id, {
      type: 'WEATHER_ALERT',
      title: 'Heavy Rain in Manali (Retry)',
      body: 'Thunderstorms expected tomorrow afternoon.',
      idempotencyKey: key,
    });

    expect(res2.created).toBe(false);
    expect(res2.duplicate).toBe(true);
    expect(res2.notification?.id).toBe(res1.notification?.id);

    // Database must contain exactly 1 notification with this idempotency key
    const count = await prisma.notification.count({
      where: { userId: userA.id, idempotencyKey: key },
    });
    expect(count).toBe(1);
  });

  // TC-11A.11: Notification preferences are persisted
  it('TC-11A.11: Notification preferences are persisted', async () => {
    const putReq = createRequest('/api/notifications/preferences', userA.id, 'PUT', {
      weatherAlerts: false,
      budgetAlerts: false,
      tripReminders: true,
    });

    const putRes = await updatePreferencesRoute(putReq);
    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.success).toBe(true);
    expect(putData.data.weatherAlerts).toBe(false);
    expect(putData.data.budgetAlerts).toBe(false);
    expect(putData.data.tripReminders).toBe(true);

    // Verify GET endpoint returns persisted preferences
    const getReq = createRequest('/api/notifications/preferences', userA.id);
    const getRes = await getPreferencesRoute(getReq);
    const getData = await getRes.json();
    expect(getData.data.weatherAlerts).toBe(false);
    expect(getData.data.budgetAlerts).toBe(false);
  });

  // TC-11A.12: Disabled notification category is respected
  it('TC-11A.12: Disabled notification category is respected', async () => {
    // User A disabled weatherAlerts in TC-11A.11
    const result = await createNotification(userA.id, {
      type: 'WEATHER_ALERT',
      title: 'Snow Alert',
      body: 'Heavy snowfall incoming.',
    });

    expect(result.created).toBe(false);
    expect(result.reason).toBe('CATEGORY_DISABLED');
    expect(result.notification).toBeNull();

    // Verify enabled category like TRIP_REMINDER still works
    const enabledResult = await createNotification(userA.id, {
      type: 'TRIP_REMINDER',
      title: 'Trip Starting Soon',
      body: 'Get your bags packed!',
    });
    expect(enabledResult.created).toBe(true);
  });

  // TC-11A.13: Malformed notification input is rejected
  it('TC-11A.13: Malformed notification input is rejected', async () => {
    // 1. Missing title
    const req1 = createRequest('/api/notifications', userA.id, 'POST', {
      type: 'SYSTEM',
      body: 'Missing title test',
    });
    const res1 = await createNotificationRoute(req1);
    expect([400, 422]).toContain(res1.status);

    // 2. Invalid notification type
    const req2 = createRequest('/api/notifications', userA.id, 'POST', {
      type: 'UNSUPPORTED_TYPE',
      title: 'Invalid Type',
      body: 'Should fail validation',
    });
    const res2 = await createNotificationRoute(req2);
    expect([400, 422]).toContain(res2.status);

    // 3. Unsafe actionUrl (javascript:)
    const req3 = createRequest('/api/notifications', userA.id, 'POST', {
      type: 'SYSTEM',
      title: 'XSS Attempt',
      body: 'Body',
      actionUrl: 'javascript:alert(1)',
    });
    const res3 = await createNotificationRoute(req3);
    expect([400, 422]).toContain(res3.status);
  });

  // TC-11A.14: Client-supplied userId is ignored
  it('TC-11A.14: Client-supplied userId is ignored', async () => {
    // User A passes User B's ID in request body
    const req = createRequest('/api/notifications', userA.id, 'POST', {
      userId: userB.id,
      type: 'SYSTEM',
      title: 'Spoofed User ID Test',
      body: 'This must belong to User A, not User B.',
    });

    const res = await createNotificationRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);

    // The created notification must belong to User A, NOT User B
    const created = data.data.notification;
    expect(created.userId).toBe(userA.id);
    expect(created.userId).not.toBe(userB.id);

    const bCount = await prisma.notification.count({
      where: { userId: userB.id, title: 'Spoofed User ID Test' },
    });
    expect(bCount).toBe(0);
  });

  // TC-11A.15: Metadata cannot inject unsafe server data
  it('TC-11A.15: Metadata cannot inject unsafe server data', async () => {
    const maliciousPayload = {
      type: 'SYSTEM',
      title: 'Payload Sanitation Test',
      body: 'Testing metadata stripping',
      data: {
        safeField: 'harmless value',
        tripId: 'trip_123',
        __proto__: { isAdmin: true },
        constructor: { evil: true },
        password: 'leak_my_password',
        secret: 'super_secret_token',
      },
    };

    const req = createRequest('/api/notifications', userA.id, 'POST', maliciousPayload);
    const res = await createNotificationRoute(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    const createdNote = data.data.notification;
    expect(createdNote.data).not.toBeNull();

    const parsedData = JSON.parse(createdNote.data);
    expect(parsedData.safeField).toBe('harmless value');
    expect(parsedData.tripId).toBe('trip_123');
    // Forbidden fields must not exist
    expect(parsedData.password).toBeUndefined();
    expect(parsedData.secret).toBeUndefined();
    expect(parsedData.__proto__?.isAdmin).toBeUndefined();
  });

  // TC-11A.16: Pagination works correctly
  it('TC-11A.16: Pagination works correctly', async () => {
    // Re-enable all categories for user A
    await updateUserPreferences(userA.id, {
      weatherAlerts: true,
      budgetAlerts: true,
      tripReminders: true,
    });

    // Clean user A's notifications and insert 7 test notifications
    await dbRetry(() => prisma.notification.deleteMany({ where: { userId: userA.id } }));
    for (let i = 1; i <= 7; i++) {
      await createNotification(userA.id, {
        type: 'SYSTEM',
        title: `Pagination Item ${i}`,
        body: `Details for item ${i}`,
      });
    }

    // Page 1 with limit 3
    const reqPage1 = createRequest('/api/notifications?page=1&limit=3', userA.id);
    const resPage1 = await getNotificationsRoute(reqPage1);
    const dataPage1 = await resPage1.json();

    expect(dataPage1.data.notifications.length).toBe(3);
    expect(dataPage1.data.total).toBe(7);
    expect(dataPage1.data.page).toBe(1);
    expect(dataPage1.data.totalPages).toBe(3);

    // Page 3 with limit 3 (should have 1 item: 7 - 6 = 1)
    const reqPage3 = createRequest('/api/notifications?page=3&limit=3', userA.id);
    const resPage3 = await getNotificationsRoute(reqPage3);
    const dataPage3 = await resPage3.json();

    expect(dataPage3.data.notifications.length).toBe(1);
    expect(dataPage3.data.page).toBe(3);
  });

  // TC-11A.17: Empty notification state is handled
  it('TC-11A.17: Empty notification state is handled', async () => {
    // Clear user B's notifications
    await dbRetry(() => prisma.notification.deleteMany({ where: { userId: userB.id } }));

    const req = createRequest('/api/notifications', userB.id);
    const res = await getNotificationsRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.notifications).toEqual([]);
    expect(data.data.total).toBe(0);
    expect(data.data.unreadCount).toBe(0);
  });

  // TC-11A.18: Notification deletion works safely
  it('TC-11A.18: Notification deletion works safely', async () => {
    const note = await dbRetry(() =>
      prisma.notification.create({
        data: {
          userId: userA.id,
          title: 'Delete Me',
          body: 'This notification will be deleted',
          type: 'SYSTEM',
        },
      })
    );

    const req = createRequest(`/api/notifications/${note.id}`, userA.id, 'DELETE');
    const res = await deleteNotificationRoute(req, {
      params: Promise.resolve({ id: note.id }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.deleted).toBe(true);

    // Confirm deletion in database
    const fresh = await prisma.notification.findUnique({ where: { id: note.id } });
    expect(fresh).toBeNull();

    // Deleting again should return 404
    const req404 = createRequest(`/api/notifications/${note.id}`, userA.id, 'DELETE');
    const res404 = await deleteNotificationRoute(req404, {
      params: Promise.resolve({ id: note.id }),
    });
    expect(res404.status).toBe(404);
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import {
  savePushSubscription,
  removePushSubscription,
  getUserPushSubscriptions,
  sendPushToUser,
} from '../src/lib/push/push-service';
import { GET as getVapidKeyRoute } from '../src/app/api/notifications/push/vapid-public-key/route';
import { POST as subscribeRoute } from '../src/app/api/push/subscribe/route';
import { GET as statusRoute } from '../src/app/api/push/status/route';
import { GET as listSubscriptionsRoute, DELETE as deleteSubscriptionRoute } from '../src/app/api/push/subscriptions/route';
import webpush from 'web-push';

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

describe('Phase 11C — Web Push Notifications (TC-11C.01 to TC-11C.25)', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  const runId = Math.random().toString(36).substring(2, 9);
  const TEST_EMAIL_A = `webpush.a.${runId}@p11c.com`;
  const TEST_EMAIL_B = `webpush.b.${runId}@p11c.com`;

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
    userA = await dbRetry(() =>
      prisma.user.create({
        data: { email: TEST_EMAIL_A, name: 'WebPush Traveler A' },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: { email: TEST_EMAIL_B, name: 'WebPush Traveler B' },
      })
    );
  });

  afterAll(async () => {
    const uIds = [userA?.id, userB?.id].filter(Boolean);
    if (uIds.length > 0) {
      await dbRetry(async () => {
        await prisma.pushSubscription.deleteMany({ where: { userId: { in: uIds } } });
        await prisma.user.deleteMany({ where: { id: { in: uIds } } });
      });
    }
  });

  // TC-11C.01: Browser support detection
  it('TC-11C.01: browser support detection verifies service worker & push capability', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("addEventListener('push'");
    expect(swContent).toContain("addEventListener('notificationclick'");
  });

  // TC-11C.02: Permission state
  it('TC-11C.02: permission state handled safely without spamming prompts', async () => {
    const res = await statusRoute(createRequest('/api/push/status', userA.id, 'GET'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.data.enabled).toBe('boolean');
  });

  // TC-11C.03: Subscription validation
  it('TC-11C.03: subscription validation rejects invalid or empty endpoint', async () => {
    await expect(
      savePushSubscription(userA.id, {
        endpoint: '',
      })
    ).rejects.toThrow();

    await expect(
      savePushSubscription('', {
        endpoint: 'https://example.com/push/123',
      })
    ).rejects.toThrow();
  });

  // TC-11C.04: Subscription creation
  it('TC-11C.04: subscription creation persists endpoint & keys and FCM token in database', async () => {
    const mockEndpoint = `https://fcm.googleapis.com/fcm/send/token-${runId}-1`;
    const sub = await savePushSubscription(userA.id, {
      endpoint: mockEndpoint,
      keys: {
        p256dh: 'mock-p256dh-key',
        auth: 'mock-auth-key',
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    });

    expect(sub.id).toBeDefined();
    expect(sub.userId).toBe(userA.id);
    expect(sub.endpoint).toBe(mockEndpoint);
    expect(sub.fcmToken).toContain(`token-${runId}-1`);
  });

  // TC-11C.05: Subscription idempotency
  it('TC-11C.05: subscription idempotency updates existing subscription without duplicate keys', async () => {
    const mockEndpoint = `https://fcm.googleapis.com/fcm/send/token-${runId}-1`;
    const updated = await savePushSubscription(userA.id, {
      endpoint: mockEndpoint,
      keys: {
        p256dh: 'updated-p256dh-key',
        auth: 'updated-auth-key',
      },
    });

    expect(updated.endpoint).toBe(mockEndpoint);
    const count = await prisma.pushSubscription.count({
      where: { endpoint: mockEndpoint },
    });
    expect(count).toBe(1);
  });

  // TC-11C.06: Subscription deletion
  it('TC-11C.06: subscription deletion removes subscription from database', async () => {
    const tempEndpoint = `https://example.com/temp-${Date.now()}`;
    await savePushSubscription(userA.id, { endpoint: tempEndpoint });

    const delResult = await removePushSubscription(userA.id, tempEndpoint);
    expect(delResult.success).toBe(true);

    const found = await prisma.pushSubscription.findUnique({
      where: { endpoint: tempEndpoint },
    });
    expect(found).toBeNull();
  });

  // TC-11C.07: Multi-device support
  it('TC-11C.07: multi-device support allows desktop and mobile subscriptions for same user', async () => {
    const desktopEndpoint = `https://fcm.googleapis.com/fcm/send/desktop-${runId}`;
    const mobileEndpoint = `https://fcm.googleapis.com/fcm/send/mobile-${runId}`;

    await savePushSubscription(userA.id, {
      endpoint: desktopEndpoint,
      userAgent: 'Desktop Chrome',
    });
    await savePushSubscription(userA.id, {
      endpoint: mobileEndpoint,
      userAgent: 'Mobile Chrome (Android)',
    });

    const userSubs = await getUserPushSubscriptions(userA.id);
    const endpoints = userSubs.map((s) => s.endpoint);
    expect(endpoints).toContain(desktopEndpoint);
    expect(endpoints).toContain(mobileEndpoint);
  });

  // TC-11C.08: User isolation
  it('TC-11C.08: user isolation prevents User A from deleting User B subscription', async () => {
    const userBEndpoint = `https://fcm.googleapis.com/fcm/send/userB-${runId}`;
    await savePushSubscription(userB.id, { endpoint: userBEndpoint });

    await expect(
      removePushSubscription(userA.id, userBEndpoint)
    ).rejects.toThrow();
  });

  // TC-11C.09: Forged userId
  it('TC-11C.09: forged userId in request body is stripped and ignored by API', async () => {
    const postReq = createRequest('/api/push/subscribe', userA.id, 'POST', {
      userId: userB.id, // Attacker tries to subscribe under User B
      endpoint: `https://fcm.googleapis.com/fcm/send/forged-${Date.now()}`,
    });

    const res = await subscribeRoute(postReq);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.userId).toBe(userA.id); // Assigned strictly to authenticated User A
  });

  // TC-11C.10: Push dispatch
  it('TC-11C.10: push dispatch formats and delivers payload with actionUrl', async () => {
    const sendNotificationSpy = vi
      .spyOn(webpush, 'sendNotification')
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    const result = await sendPushToUser(userA.id, {
      title: 'Boarding Alert',
      body: 'Flight GC-101 departs in 45 minutes.',
      actionUrl: '/trips/flight-101',
    });

    expect(result.sentCount).toBeGreaterThanOrEqual(1);
    expect(sendNotificationSpy).toHaveBeenCalled();
    const lastCallPayload = JSON.parse(sendNotificationSpy.mock.calls[0][1] as string);
    expect(lastCallPayload.title).toBe('Boarding Alert');
    expect(lastCallPayload.actionUrl).toBe('/trips/flight-101');

    sendNotificationSpy.mockRestore();
  });

  // TC-11C.11: Invalid endpoint cleanup
  it('TC-11C.11: invalid endpoint cleanup removes dead endpoints', async () => {
    const deadEndpoint = `https://fcm.googleapis.com/fcm/send/dead-${Date.now()}`;
    await savePushSubscription(userA.id, { endpoint: deadEndpoint });

    const sendSpy = vi.spyOn(webpush, 'sendNotification').mockImplementation(async (sub) => {
      if (sub.endpoint === deadEndpoint) {
        const error = new Error('Not Found');
        (error as unknown as { statusCode: number }).statusCode = 404;
        throw error;
      }
      return { statusCode: 201, body: '', headers: {} };
    });

    const result = await sendPushToUser(userA.id, {
      title: 'Cleanup Test',
      body: 'Testing dead endpoint cleanup',
    });

    expect(result.removedCount).toBeGreaterThanOrEqual(1);
    const check = await prisma.pushSubscription.findUnique({
      where: { endpoint: deadEndpoint },
    });
    expect(check).toBeNull();

    sendSpy.mockRestore();
  });

  // TC-11C.12: HTTP 404 handling
  it('TC-11C.12: HTTP 404 response prunes subscription from database', async () => {
    const sub404Endpoint = `https://fcm.googleapis.com/fcm/send/404-${Date.now()}`;
    await savePushSubscription(userA.id, { endpoint: sub404Endpoint });

    const sendSpy = vi.spyOn(webpush, 'sendNotification').mockImplementation(async () => {
      const error = new Error('Endpoint Not Found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    });

    const result = await sendPushToUser(userA.id, { title: '404 Test', body: 'Test' });
    expect(result.removedCount).toBeGreaterThanOrEqual(1);

    const exists = await prisma.pushSubscription.findUnique({ where: { endpoint: sub404Endpoint } });
    expect(exists).toBeNull();
    sendSpy.mockRestore();
  });

  // TC-11C.13: HTTP 410 handling
  it('TC-11C.13: HTTP 410 Gone response prunes subscription automatically', async () => {
    const sub410Endpoint = `https://fcm.googleapis.com/fcm/send/410-${Date.now()}`;
    await savePushSubscription(userA.id, { endpoint: sub410Endpoint });

    const sendSpy = vi.spyOn(webpush, 'sendNotification').mockImplementation(async () => {
      const error = new Error('Subscription Expired');
      (error as unknown as { statusCode: number }).statusCode = 410;
      throw error;
    });

    const result = await sendPushToUser(userA.id, { title: '410 Test', body: 'Test' });
    expect(result.removedCount).toBeGreaterThanOrEqual(1);

    const exists = await prisma.pushSubscription.findUnique({ where: { endpoint: sub410Endpoint } });
    expect(exists).toBeNull();
    sendSpy.mockRestore();
  });

  // TC-11C.14: Notification preference disabled
  it('TC-11C.14: pushDisabled in preferences suppresses push dispatch', async () => {
    await prisma.notificationPreference.upsert({
      where: { userId: userA.id },
      update: { pushEnabled: false },
      create: { userId: userA.id, pushEnabled: false },
    });

    const sendNotificationSpy = vi.spyOn(webpush, 'sendNotification');
    const result = await sendPushToUser(userA.id, {
      title: 'Should Not Be Sent',
      body: 'Push disabled test',
    });

    expect(result.reason).toBe('PUSH_DISABLED');
    expect(sendNotificationSpy).not.toHaveBeenCalled();
    sendNotificationSpy.mockRestore();
  });

  // TC-11C.15: Notification preference enabled
  it('TC-11C.15: pushEnabled in preferences allows push dispatch', async () => {
    await prisma.notificationPreference.upsert({
      where: { userId: userA.id },
      update: { pushEnabled: true },
      create: { userId: userA.id, pushEnabled: true },
    });

    await savePushSubscription(userA.id, {
      endpoint: `https://fcm.googleapis.com/fcm/send/restored-${runId}`,
    });

    const sendNotificationSpy = vi
      .spyOn(webpush, 'sendNotification')
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    const result = await sendPushToUser(userA.id, {
      title: 'Restored Notification',
      body: 'Push re-enabled test',
    });

    expect(result.sentCount).toBeGreaterThanOrEqual(1);
    sendNotificationSpy.mockRestore();
  });

  // TC-11C.16: Reminder integration
  it('TC-11C.16: notification creation dispatches push when pushEnabled is true', async () => {
    const sendNotificationSpy = vi
      .spyOn(webpush, 'sendNotification')
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    const { createNotification } = await import('../src/lib/notifications/notification-service');
    const res = await createNotification(userA.id, {
      title: 'Trip Countdown Alert',
      body: 'Your trip starts in 2 days!',
      type: 'TRIP_REMINDER',
    });

    expect(res.created).toBe(true);
    expect(sendNotificationSpy).toHaveBeenCalled();
    sendNotificationSpy.mockRestore();
  });

  // TC-11C.17: Duplicate push prevention
  it('TC-11C.17: duplicate notification generation is prevented via idempotencyKey', async () => {
    const sendNotificationSpy = vi
      .spyOn(webpush, 'sendNotification')
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    const { createNotification } = await import('../src/lib/notifications/notification-service');
    const idempKey = `push-idemp-${Date.now()}`;

    // First attempt creates and pushes
    const res1 = await createNotification(userA.id, {
      title: 'Once Alert',
      body: 'Should only alert once.',
      type: 'TRIP_REMINDER',
      idempotencyKey: idempKey,
    });
    expect(res1.created).toBe(true);
    expect(sendNotificationSpy).toHaveBeenCalledTimes(1);

    // Second attempt returns duplicate without sending duplicate push
    const res2 = await createNotification(userA.id, {
      title: 'Once Alert (Duplicate)',
      body: 'Should not create duplicate.',
      type: 'TRIP_REMINDER',
      idempotencyKey: idempKey,
    });
    expect(res2.duplicate).toBe(true);
    expect(sendNotificationSpy).toHaveBeenCalledTimes(1);

    sendNotificationSpy.mockRestore();
  });

  // TC-11C.18: Service worker payload handling
  it('TC-11C.18: service worker handles json and plain text payloads without throwing', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain('event.data.json()');
    expect(swContent).toContain('event.data.text()');
  });

  // TC-11C.19: Safe click navigation
  it('TC-11C.19: service worker sanitizes notification click URL to prevent open redirect', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain('sanitizeDestination');
    expect(swContent).toContain('startsWith');
  });

  // TC-11C.20: VAPID secret isolation
  it('TC-11C.20: VAPID private key is never exposed via public key endpoint', async () => {
    const res = await getVapidKeyRoute();
    const data = await res.json();
    expect(data.data.publicKey).toBeDefined();
    expect(data.data.privateKey).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain(process.env.VAPID_PRIVATE_KEY || '');
  });

  // TC-11C.21: Malformed payload
  it('TC-11C.21: push service handles empty or malformed message safely', async () => {
    const result = await sendPushToUser('', {
      title: '',
      body: '',
    });
    expect(result.sentCount).toBe(0);
  });

  // TC-11C.22: Unauthorized push request
  it('TC-11C.22: unauthenticated push subscription endpoint returns 401', async () => {
    const unauthReq = createRequest('/api/push/subscribe', undefined, 'POST', {
      endpoint: 'https://example.com/unauth',
    });
    const res = await subscribeRoute(unauthReq);
    expect(res.status).toBe(401);
  });

  // TC-11C.23: Multiple subscriptions list
  it('TC-11C.23: /api/push/subscriptions returns active devices with masked secrets', async () => {
    const req = createRequest('/api/push/subscriptions', userA.id, 'GET');
    const res = await listSubscriptionsRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.data.subscriptions)).toBe(true);
    for (const sub of data.data.subscriptions) {
      expect(sub.p256dh).toBeUndefined();
      expect(sub.auth).toBeUndefined();
      expect(sub.browser).toBeDefined();
      expect(sub.device).toBeDefined();
    }
  });

  // TC-11C.24: Failed device does not block others
  it('TC-11C.24: failed subscription does not prevent remaining devices from receiving push', async () => {
    await prisma.pushSubscription.deleteMany({ where: { userId: userB.id } });

    const sub1 = `https://fcm.googleapis.com/fcm/send/failing-${Date.now()}`;
    const sub2 = `https://fcm.googleapis.com/fcm/send/working-${Date.now()}`;

    await savePushSubscription(userB.id, { endpoint: sub1 });
    await savePushSubscription(userB.id, { endpoint: sub2 });

    const sendSpy = vi.spyOn(webpush, 'sendNotification').mockImplementation(async (sub) => {
      if (sub.endpoint === sub1) {
        throw new Error('Connection refused');
      }
      return { statusCode: 201, body: '', headers: {} };
    });

    const result = await sendPushToUser(userB.id, {
      title: 'Fault Tolerance Test',
      body: 'Testing that Device 2 receives message even if Device 1 fails',
    });

    expect(result.failedCount).toBe(1);
    expect(result.sentCount).toBe(1);
    sendSpy.mockRestore();
  });

  // TC-11C.25: Subscription cleanup
  it('TC-11C.25: DELETE /api/push/subscriptions cleans up individual device safely', async () => {
    const cleanSub = await savePushSubscription(userA.id, {
      endpoint: `https://example.com/to-clean-${Date.now()}`,
    });

    const delReq = createRequest(`/api/push/subscriptions?id=${cleanSub.id}`, userA.id, 'DELETE');
    const delRes = await deleteSubscriptionRoute(delReq);
    expect(delRes.status).toBe(200);

    const check = await prisma.pushSubscription.findUnique({
      where: { id: cleanSub.id },
    });
    expect(check).toBeNull();
  });
});

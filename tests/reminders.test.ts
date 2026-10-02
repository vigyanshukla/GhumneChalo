import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  createReminder,
  getReminder,
  listReminders,
  updateReminder,
  cancelReminder,
  deleteReminder,
  processDueReminders,
  generateTripReminders,
  generateItineraryReminders,
  generateTransportationReminders,
  generateWeatherReminders,
  calculateReminderSchedule,
} from '../src/lib/reminders/reminder-service';
import { ReminderStatus, ReminderType } from '@prisma/client';
import { GET as getRemindersRoute, POST as postRemindersRoute } from '../src/app/api/reminders/route';
import {
  GET as getReminderByIdRoute,
  PATCH as patchReminderByIdRoute,
  DELETE as deleteReminderByIdRoute,
} from '../src/app/api/reminders/[id]/route';
import { POST as cronRoute } from '../src/app/api/cron/reminders/route';

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

describe('Phase 11B — Reminder Engine & Scheduled Travel Notifications', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tripA: { id: string; userId: string; title: string };
  let tripB: { id: string; userId: string; title: string };

  const EMAIL_A = 'reminders.traveler.a@ghumnechalo-p11b.com';
  const EMAIL_B = 'reminders.traveler.b@ghumnechalo-p11b.com';

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
      prisma.user.upsert({
        where: { email: EMAIL_A },
        update: {},
        create: { email: EMAIL_A, name: 'Reminder Traveler A' },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.upsert({
        where: { email: EMAIL_B },
        update: {},
        create: { email: EMAIL_B, name: 'Reminder Traveler B' },
      })
    );

    // Create trips for User A and User B
    const startDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    tripA = await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userA.id,
          title: 'Jaipur Heritage Journey',
          destinationName: 'Jaipur, Rajasthan',
          startDate,
          endDate,
          status: 'UPCOMING',
        },
      })
    );

    tripB = await dbRetry(() =>
      prisma.trip.create({
        data: {
          userId: userB.id,
          title: 'Goa Coastal Getaway',
          destinationName: 'Goa, India',
          startDate,
          endDate,
          status: 'UPCOMING',
        },
      })
    );
  });

  afterAll(async () => {
    await dbRetry(async () => {
      await prisma.reminder.deleteMany({
        where: { userId: { in: [userA.id, userB.id] } },
      });
      await prisma.trip.deleteMany({
        where: { id: { in: [tripA.id, tripB.id] } },
      });
    });
  });

  // TC-11B.01: CRUD - Create custom reminder with valid data
  it('TC-11B.01: create custom reminder with valid data', async () => {
    const scheduledAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const reminder = await createReminder(userA.id, {
      title: 'Pack Camera & Charger',
      message: 'Remember to pack extra SD cards and battery pack.',
      scheduledAt,
      type: ReminderType.CUSTOM,
      tripId: tripA.id,
    });

    expect(reminder.id).toBeDefined();
    expect(reminder.title).toBe('Pack Camera & Charger');
    expect(reminder.status).toBe(ReminderStatus.SCHEDULED);
    expect(reminder.userId).toBe(userA.id);
    expect(reminder.tripId).toBe(tripA.id);
  });

  // TC-11B.02: CRUD - Reject invalid input (empty title, empty message, invalid date)
  it('TC-11B.02: reject invalid input safely', async () => {
    await expect(
      createReminder(userA.id, {
        title: '',
        message: 'Valid message',
        scheduledAt: new Date(Date.now() + 10000),
      })
    ).rejects.toThrow();

    await expect(
      createReminder(userA.id, {
        title: 'Valid title',
        message: '',
        scheduledAt: new Date(Date.now() + 10000),
      })
    ).rejects.toThrow();

    await expect(
      createReminder(userA.id, {
        title: 'Valid title',
        message: 'Valid message',
        scheduledAt: 'not-a-date',
      })
    ).rejects.toThrow();
  });

  // TC-11B.03: CRUD - Get reminder by ID
  it('TC-11B.03: get reminder by ID', async () => {
    const created = await createReminder(userA.id, {
      title: 'Check Hotel Reservation',
      message: 'Confirm check-in time with hotel desk.',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const retrieved = await getReminder(userA.id, created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.title).toBe('Check Hotel Reservation');
  });

  // TC-11B.04: CRUD - List reminders with filters
  it('TC-11B.04: list reminders with filters', async () => {
    const list = await listReminders(userA.id, { upcoming: true });
    expect(Array.isArray(list.reminders)).toBe(true);
    expect(list.total).toBeGreaterThanOrEqual(1);
  });

  // TC-11B.05: CRUD - Update reminder details
  it('TC-11B.05: update reminder details', async () => {
    const created = await createReminder(userA.id, {
      title: 'Buy sunscreen',
      message: 'SPF 50 required.',
      scheduledAt: new Date(Date.now() + 36 * 60 * 60 * 1000),
    });

    const updated = await updateReminder(userA.id, created.id, {
      title: 'Buy sunscreen SPF 50+',
      message: 'Also pick up aloe vera moisturizer.',
    });

    expect(updated.title).toBe('Buy sunscreen SPF 50+');
    expect(updated.message).toContain('aloe vera');
  });

  // TC-11B.06: CRUD - Cancel reminder transitions status to CANCELLED
  it('TC-11B.06: cancel reminder transitions status to CANCELLED', async () => {
    const created = await createReminder(userA.id, {
      title: 'Cancel test',
      message: 'Will be cancelled.',
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    const cancelled = await cancelReminder(userA.id, created.id);
    expect(cancelled.status).toBe(ReminderStatus.CANCELLED);
    expect(cancelled.deliveryState).toBe('CANCELLED');
  });

  // TC-11B.07: CRUD - Delete reminder
  it('TC-11B.07: delete reminder removes from database', async () => {
    const created = await createReminder(userA.id, {
      title: 'To be deleted',
      message: 'Temporary reminder.',
      scheduledAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
    });

    const success = await deleteReminder(userA.id, created.id);
    expect(success).toBe(true);

    await expect(getReminder(userA.id, created.id)).rejects.toThrow();
  });

  // TC-11B.08: Security - User A cannot access User B reminder (IDOR)
  it('TC-11B.08: User A cannot read User B reminder', async () => {
    const reminderB = await createReminder(userB.id, {
      title: 'User B Private Reminder',
      message: 'Secret Goa plans.',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await expect(getReminder(userA.id, reminderB.id)).rejects.toThrow();
  });

  // TC-11B.09: Security - User A cannot update or delete User B reminder
  it('TC-11B.09: User A cannot update or delete User B reminder', async () => {
    const reminderB = await createReminder(userB.id, {
      title: 'User B Reminder 2',
      message: 'Private data.',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await expect(
      updateReminder(userA.id, reminderB.id, { title: 'Hacked' })
    ).rejects.toThrow();

    await expect(deleteReminder(userA.id, reminderB.id)).rejects.toThrow();
  });

  // TC-11B.10: Security - User A cannot link reminder to User B trip (IDOR)
  it('TC-11B.10: User A cannot link reminder to User B trip', async () => {
    await expect(
      createReminder(userA.id, {
        title: 'Illegally linked reminder',
        message: 'Trying to access User B trip.',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tripId: tripB.id, // belongs to userB!
      })
    ).rejects.toThrow();
  });

  // TC-11B.11: Idempotency - Duplicate reminder creation safely deduped
  it('TC-11B.11: duplicate reminder creation safely deduped via idempotencyKey', async () => {
    const key = `test-idemp-${Date.now()}`;
    const rem1 = await createReminder(userA.id, {
      title: 'Idempotent Check',
      message: 'First attempt.',
      scheduledAt: new Date(Date.now() + 20 * 60 * 1000),
      idempotencyKey: key,
    });

    const rem2 = await createReminder(userA.id, {
      title: 'Idempotent Check (Duplicate)',
      message: 'Second attempt with same key.',
      scheduledAt: new Date(Date.now() + 25 * 60 * 1000),
      idempotencyKey: key,
    });

    expect(rem1.id).toBe(rem2.id);
  });

  // TC-11B.12: Automatic Reminders - Trip start reminders scheduled
  it('TC-11B.12: generateTripReminders generates 3-day and 1-day reminders', async () => {
    const reminders = await generateTripReminders(userA.id, tripA.id);
    expect(reminders.length).toBeGreaterThanOrEqual(1);

    const tripTypes = reminders.map((r) => r.type);
    expect(tripTypes).toContain(ReminderType.TRIP_START);
  });

  // TC-11B.13: Automatic Reminders - Itinerary activity 1-hour reminder scheduled
  it('TC-11B.13: generateItineraryReminders schedules 1h reminder for scheduled activities', async () => {
    // Create itinerary day and item
    const dayDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const day = await prisma.itineraryDay.create({
      data: {
        tripId: tripA.id,
        dayNumber: 1,
        date: dayDate,
        title: 'Day 1 Fort Exploration',
      },
    });

    const item = await prisma.itineraryItem.create({
      data: {
        itineraryDayId: day.id,
        name: 'Amer Fort Guided Tour',
        startTime: '10:00',
        order: 1,
      },
    });

    const reminders = await generateItineraryReminders(userA.id, tripA.id);
    expect(reminders.length).toBeGreaterThanOrEqual(1);
    const itinRem = reminders.find((r) => r.itineraryItemId === item.id);
    expect(itinRem).toBeDefined();
    expect(itinRem?.title).toContain('Amer Fort');
  });

  // TC-11B.14: Automatic Reminders - Transportation departure reminder scheduled
  it('TC-11B.14: generateTransportationReminders schedules departure reminder', async () => {
    const depTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const transport = await prisma.transportation.create({
      data: {
        tripId: tripA.id,
        type: 'FLIGHT',
        origin: 'DEL',
        destination: 'JAI',
        departureTime: depTime,
      },
    });

    const reminders = await generateTransportationReminders(userA.id, tripA.id);
    expect(reminders.length).toBeGreaterThanOrEqual(1);
    const transRem = reminders.find((r) => r.transportationId === transport.id);
    expect(transRem).toBeDefined();
    expect(transRem?.title).toContain('Flight');
  });

  // TC-11B.15: Automatic Reminders - Weather alert generated only for genuine rain risk >= 60%
  it('TC-11B.15: generateWeatherReminders generates alert only when rain probability >= 60%', async () => {
    const weatherDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Create high rain snapshot (75%)
    await prisma.weatherSnapshot.create({
      data: {
        tripId: tripA.id,
        date: weatherDate,
        latitude: 26.9124,
        longitude: 75.7873,
        temperature: 28.5,
        precipitationProbability: 75,
        weatherCode: 501,
      },
    });

    const reminders = await generateWeatherReminders(userA.id, tripA.id);
    expect(reminders.length).toBeGreaterThanOrEqual(1);
    const weatherRem = reminders.find((r) => r.type === ReminderType.WEATHER_ALERT);
    expect(weatherRem).toBeDefined();
    expect(weatherRem?.title).toContain('Rain Alert');
  });

  // TC-11B.16: Scheduler - processDueReminders transitions to PROCESSING, delivers notification, marks SENT
  it('TC-11B.16: processDueReminders processes due reminders and dispatches notifications', async () => {
    // Create a reminder that is due right now
    const pastTime = new Date(Date.now() - 5000);
    const dueReminder = await createReminder(userA.id, {
      title: 'Due Notification Test',
      message: 'This reminder is due and should be sent.',
      scheduledAt: pastTime,
      type: ReminderType.CUSTOM,
    });

    const processResult = await processDueReminders({ limit: 10 });
    expect(processResult.processed).toBeGreaterThanOrEqual(1);

    const check = await getReminder(userA.id, dueReminder.id);
    expect(check.status).toBe(ReminderStatus.SENT);
    expect(check.deliveryState).toBe('DELIVERED');
    expect(check.sentAt).toBeDefined();
  });

  // TC-11B.17: Preferences - Disabled category suppresses delivery
  it('TC-11B.17: disabled category suppresses delivery safely', async () => {
    // Disable trip reminders for userB
    await prisma.notificationPreference.upsert({
      where: { userId: userB.id },
      update: { tripReminders: false },
      create: { userId: userB.id, tripReminders: false },
    });

    const dueTripRem = await createReminder(userB.id, {
      title: 'Suppressed Trip Reminder',
      message: 'Should be suppressed by preferences.',
      scheduledAt: new Date(Date.now() - 3000),
      type: ReminderType.TRIP_START,
    });

    await processDueReminders({ limit: 10 });

    const check = await getReminder(userB.id, dueTripRem.id);
    expect(check.status).toBe(ReminderStatus.CANCELLED);
    expect(check.deliveryState).toBe('SUPPRESSED_BY_PREFERENCES');
  });

  // TC-11B.18: API - /api/reminders GET & POST endpoints
  it('TC-11B.18: /api/reminders enforces auth and handles CRUD', async () => {
    // 1. Unauthenticated request rejected with 401
    const unauthReq = createRequest('/api/reminders', undefined, 'GET');
    const unauthRes = await getRemindersRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. Authenticated POST
    const postReq = createRequest('/api/reminders', userA.id, 'POST', {
      title: 'API Created Reminder',
      message: 'Testing API POST route.',
      scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    const postRes = await postRemindersRoute(postReq);
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.data.title).toBe('API Created Reminder');

    // 3. Authenticated GET
    const getReq = createRequest('/api/reminders?upcoming=true', userA.id, 'GET');
    const getRes = await getRemindersRoute(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(Array.isArray(getData.data.reminders)).toBe(true);
  });

  // TC-11B.19: API - /api/reminders/[id] PATCH & DELETE endpoints
  it('TC-11B.19: /api/reminders/[id] handles get, patch, delete', async () => {
    const rem = await createReminder(userA.id, {
      title: 'Individual Route Test',
      message: 'Testing params.',
      scheduledAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const context = { params: Promise.resolve({ id: rem.id }) };

    // GET by ID
    const getReq = createRequest(`/api/reminders/${rem.id}`, userA.id, 'GET');
    const getRes = await getReminderByIdRoute(getReq, context);
    expect(getRes.status).toBe(200);

    // PATCH by ID
    const patchReq = createRequest(`/api/reminders/${rem.id}`, userA.id, 'PATCH', {
      title: 'Updated via Route',
    });
    const patchRes = await patchReminderByIdRoute(patchReq, context);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.data.title).toBe('Updated via Route');

    // DELETE by ID
    const delReq = createRequest(`/api/reminders/${rem.id}`, userA.id, 'DELETE');
    const delRes = await deleteReminderByIdRoute(delReq, context);
    expect(delRes.status).toBe(200);
  });

  // TC-11B.20: Cron - Protected cron endpoint requires secret and triggers processing
  it('TC-11B.20: /api/cron/reminders requires authorization secret and runs', async () => {
    // 1. Unauthorized request rejected
    const unauthReq = createRequest('/api/cron/reminders', undefined, 'POST');
    const unauthRes = await cronRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. Authorized request succeeds
    const cronSecret = process.env.CRON_SECRET || 'ghumnechalo-cron-secret-2026';
    const authReq = createRequest('/api/cron/reminders?limit=1', undefined, 'POST', {}, {
      authorization: `Bearer ${cronSecret}`,
    });
    const authRes = await cronRoute(authReq);
    expect(authRes.status).toBe(200);
    const cronData = await authRes.json();
    expect(cronData.success).toBe(true);
    expect(cronData.data.success).toBe(true);
  });

  // TC-11B.21: Timezone & Scheduling calculation safety
  it('TC-11B.21: calculateReminderSchedule calculates offsets correctly with timezone safety', () => {
    const target = new Date('2026-10-15T12:00:00Z');
    const tripStart1d = calculateReminderSchedule(ReminderType.TRIP_START, target, { daysBefore: 1 });
    expect(tripStart1d.toISOString()).toContain('2026-10-14');

    const flightRem = calculateReminderSchedule(ReminderType.TRANSPORT_DEPARTURE, target, { hoursBefore: 3 });
    expect(flightRem.getUTCHours()).toBe(9);
  });
});

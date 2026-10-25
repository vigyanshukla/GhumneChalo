import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { createReminder } from '../src/lib/reminders/reminder-service';
import { ReminderType, ReminderStatus } from '@prisma/client';
import { runScheduledReminderCron } from '../src/lib/notifications/reminder-engine';

describe('Phase 14 — Production Cron & Reminder E2E Flow', () => {
  const testEmail = `cron-e2e-${Date.now()}@ghumnechalo.test`;
  let testUserId: string;
  let testTripId: string;

  beforeAll(async () => {
    // 1. Setup test user
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Cron Test Traveler',
        notificationPreference: {
          create: {
            tripReminders: true,
            itineraryReminders: true,
            transportationReminders: true,
            weatherAlerts: true,
            budgetAlerts: true,
            pushEnabled: true,
          },
        },
      },
    });
    testUserId = user.id;

    // 2. Setup trip
    const trip = await prisma.trip.create({
      data: {
        userId: testUserId,
        title: 'Manali Expedition',
        destinationName: 'Manali, Himachal Pradesh',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 86400000 * 4),
      },
    });
    testTripId = trip.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.notification.deleteMany({ where: { userId: testUserId } });
    await prisma.reminder.deleteMany({ where: { userId: testUserId } });
    await prisma.trip.deleteMany({ where: { id: testTripId } });
    await prisma.notificationPreference.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('TC-14.01: Cron rejects missing or invalid CRON_SECRET with UnauthorizedError', async () => {
    await expect(
      runScheduledReminderCron('invalid-secret-key-xyz', { userId: testUserId })
    ).rejects.toThrow(/Unauthorized cron trigger/);
  });

  it('TC-14.02: End-to-end flow: Reminder -> Due -> Cron Execution -> Notification creation -> Status SENT', async () => {
    const cronSecret = process.env.CRON_SECRET || 'ghumnechalo-cron-secret-2026';

    // 1. Create a reminder scheduled in the past so it is immediately due
    const pastTime = new Date(Date.now() - 5000);
    const reminder = await createReminder(testUserId, {
      tripId: testTripId,
      type: ReminderType.CUSTOM,
      title: 'Pack Camera & Chargers',
      message: 'Remember to pack camera batteries and high-speed memory cards.',
      scheduledAt: pastTime,
    });

    expect(reminder.status).toBe(ReminderStatus.SCHEDULED);

    // 2. Execute cron runner with valid secret
    const cronResult = await runScheduledReminderCron(cronSecret, {
      userId: testUserId,
      referenceTime: new Date(),
    });

    expect(cronResult.success).toBe(true);
    expect(cronResult.dueRemindersProcessed).toBeGreaterThanOrEqual(1);

    // 3. Verify reminder transitioned to SENT in database
    const updatedReminder = await prisma.reminder.findUnique({
      where: { id: reminder.id },
    });
    expect(updatedReminder?.status).toBe(ReminderStatus.SENT);
    expect(updatedReminder?.deliveryState).toBe('DELIVERED');
    expect(updatedReminder?.sentAt).not.toBeNull();

    // 4. Verify corresponding notification was created in database
    const notification = await prisma.notification.findFirst({
      where: {
        userId: testUserId,
        idempotencyKey: `rem-deliv-${reminder.id}`,
      },
    });
    expect(notification).not.toBeNull();
    expect(notification?.title).toBe('Pack Camera & Chargers');
    expect(notification?.body).toContain('Remember to pack camera batteries');
  });

  it('TC-14.03: Duplicate cron execution is idempotent and prevents duplicate notifications', async () => {
    const cronSecret = process.env.CRON_SECRET || 'ghumnechalo-cron-secret-2026';

    // Count notifications before second run
    const countBefore = await prisma.notification.count({
      where: { userId: testUserId },
    });

    // Run cron again
    const secondRun = await runScheduledReminderCron(cronSecret, {
      userId: testUserId,
      referenceTime: new Date(),
    });

    expect(secondRun.success).toBe(true);

    // Count notifications after second run: must NOT increase
    const countAfter = await prisma.notification.count({
      where: { userId: testUserId },
    });

    expect(countAfter).toBe(countBefore);
  });
});

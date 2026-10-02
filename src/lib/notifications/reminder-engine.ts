import { prisma } from '@/lib/prisma';
import { createNotification } from './notification-service';
import { CreateNotificationResult } from './notification-service';
import { UnauthorizedError, ValidationError } from '@/lib/api-error';

export interface ReminderEngineOptions {
  referenceTime?: Date;
  timezone?: string;
  forceWindow?: string;
  userId?: string;
  limit?: number;
}

export interface ReminderEvaluationSummary {
  evaluatedCategories: string[];
  notificationsGenerated: number;
  duplicatesSkipped: number;
  disabledCategoriesSkipped: number;
  results: CreateNotificationResult[];
}

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Helper to format date in a target timezone safely
 */
export function formatDateInTimezone(date: Date, timezone = DEFAULT_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}

/**
 * 11B.1 & 11B.2: Upcoming Trip Reminder Evaluator
 * Evaluates trips starting within 1 to 3 days from referenceTime
 */
export async function evaluateTripReminders(
  userId: string,
  options: ReminderEngineOptions = {}
): Promise<CreateNotificationResult[]> {
  if (!userId) throw new ValidationError('User ID is required');

  const refTime = options.referenceTime ? new Date(options.referenceTime) : new Date();
  const tz = options.timezone || DEFAULT_TIMEZONE;

  // Window: starts within next 72 hours and in the future
  const windowEnd = new Date(refTime.getTime() + 72 * 60 * 60 * 1000);

  const upcomingTrips = await prisma.trip.findMany({
    where: {
      userId,
      isArchived: false,
      startDate: {
        gte: refTime,
        lte: windowEnd,
      },
    },
  });

  const results: CreateNotificationResult[] = [];

  for (const trip of upcomingTrips) {
    const formattedDate = formatDateInTimezone(trip.startDate, tz);
    const dateKey = trip.startDate.toISOString().split('T')[0];
    const idempotencyKey = `TRIP_UPCOMING:${trip.id}:${dateKey}`;

    const res = await createNotification(userId, {
      type: 'TRIP_UPCOMING',
      title: `Upcoming Trip: ${trip.title}`,
      body: `Your journey to ${trip.destinationName} starts on ${formattedDate}. Check your itinerary, route, and packing list!`,
      actionUrl: `/trips/${trip.id}`,
      idempotencyKey,
      data: {
        tripId: trip.id,
        destinationName: trip.destinationName,
        startDate: trip.startDate.toISOString(),
      },
    });

    results.push(res);
  }

  return results;
}

/**
 * 11B.1 & 11B.2: Itinerary Activity Reminder Evaluator
 * Evaluates itinerary activities happening today or tomorrow
 */
export async function evaluateItineraryReminders(
  userId: string,
  options: ReminderEngineOptions = {}
): Promise<CreateNotificationResult[]> {
  if (!userId) throw new ValidationError('User ID is required');

  const refTime = options.referenceTime ? new Date(options.referenceTime) : new Date();

  // Find user's active/upcoming trips
  const activeTrips = await prisma.trip.findMany({
    where: {
      userId,
      isArchived: false,
      endDate: { gte: refTime },
    },
    select: { id: true, title: true },
  });

  if (activeTrips.length === 0) return [];
  const tripIds = activeTrips.map((t) => t.id);

  // Window: today through next 36 hours
  const windowEnd = new Date(refTime.getTime() + 36 * 60 * 60 * 1000);

  const upcomingDays = await prisma.itineraryDay.findMany({
    where: {
      tripId: { in: tripIds },
      date: {
        gte: new Date(refTime.getTime() - 24 * 60 * 60 * 1000), // include current day
        lte: windowEnd,
      },
    },
    include: {
      items: {
        orderBy: { order: 'asc' },
      },
    },
  });

  const results: CreateNotificationResult[] = [];

  for (const day of upcomingDays) {
    const dayDateStr = day.date.toISOString().split('T')[0];

    for (const item of day.items) {
      const idempotencyKey = `ITINERARY_UPCOMING:${item.id}:${dayDateStr}`;
      const timeInfo = item.startTime ? ` at ${item.startTime}` : '';

      const res = await createNotification(userId, {
        type: 'ITINERARY_UPCOMING',
        title: `Activity: ${item.name}`,
        body: `Day ${day.dayNumber} activity "${item.name}" is scheduled${timeInfo}.`,
        actionUrl: `/trips/${day.tripId}`,
        idempotencyKey,
        data: {
          activityId: item.id,
          tripId: day.tripId,
          dayNumber: day.dayNumber,
          startTime: item.startTime,
        },
      });

      results.push(res);
    }
  }

  return results;
}

/**
 * 11B.1 & 11B.2: Transportation Departure & Arrival Evaluator
 * Evaluates transport departures within 24 hours
 */
export async function evaluateTransportationReminders(
  userId: string,
  options: ReminderEngineOptions = {}
): Promise<CreateNotificationResult[]> {
  if (!userId) throw new ValidationError('User ID is required');

  const refTime = options.referenceTime ? new Date(options.referenceTime) : new Date();
  const tz = options.timezone || DEFAULT_TIMEZONE;
  const windowEnd = new Date(refTime.getTime() + 24 * 60 * 60 * 1000);

  const upcomingTransport = await prisma.transportation.findMany({
    where: {
      trip: {
        userId,
        isArchived: false,
      },
      departureTime: {
        gte: refTime,
        lte: windowEnd,
      },
    },
    include: {
      trip: {
        select: { id: true, title: true },
      },
    },
  });

  const results: CreateNotificationResult[] = [];

  for (const transit of upcomingTransport) {
    if (!transit.departureTime) continue;

    const formattedDeparture = formatDateInTimezone(transit.departureTime, tz);
    const dateKey = transit.departureTime.toISOString().split('T')[0];
    const idempotencyKey = `TRANSPORT_DEPARTURE:${transit.id}:${dateKey}`;

    const res = await createNotification(userId, {
      type: 'TRANSPORT_DEPARTURE',
      title: `${transit.type} Departure: ${transit.origin} → ${transit.destination}`,
      body: `Your ${transit.type.toLowerCase()} departs at ${formattedDeparture}. Please arrive at ${transit.origin} with valid tickets & ID.`,
      actionUrl: `/trips/${transit.tripId}`,
      idempotencyKey,
      data: {
        transportId: transit.id,
        tripId: transit.tripId,
        origin: transit.origin,
        destination: transit.destination,
        type: transit.type,
      },
    });

    results.push(res);
  }

  return results;
}

/**
 * 11B.1 & 11B.2: Weather Alert Evaluator
 * Evaluates weather forecasts with high precipitation probability (>= 70%) or adverse codes
 */
export async function evaluateWeatherAlerts(
  userId: string,
  options: ReminderEngineOptions = {}
): Promise<CreateNotificationResult[]> {
  if (!userId) throw new ValidationError('User ID is required');

  const refTime = options.referenceTime ? new Date(options.referenceTime) : new Date();
  const tz = options.timezone || DEFAULT_TIMEZONE;
  const windowEnd = new Date(refTime.getTime() + 48 * 60 * 60 * 1000);

  const snapshots = await prisma.weatherSnapshot.findMany({
    where: {
      trip: {
        userId,
        isArchived: false,
      },
      date: {
        gte: refTime,
        lte: windowEnd,
      },
      OR: [
        { precipitationProbability: { gte: 70 } },
        { temperature: { lte: 0 } },
        { temperature: { gte: 42 } },
      ],
    },
    include: {
      trip: {
        select: { id: true, destinationName: true },
      },
    },
  });

  const results: CreateNotificationResult[] = [];

  for (const snap of snapshots) {
    const dateKey = snap.date.toISOString().split('T')[0];
    const idempotencyKey = `WEATHER_ALERT:${snap.tripId}:${dateKey}`;

    let condition = 'Adverse Weather';
    if (snap.precipitationProbability && snap.precipitationProbability >= 70) {
      condition = `Heavy Rain Expected (${snap.precipitationProbability}% chance)`;
    } else if (snap.temperature && snap.temperature <= 0) {
      condition = `Freezing Temperatures (${snap.temperature}°C)`;
    } else if (snap.temperature && snap.temperature >= 42) {
      condition = `Extreme Heat Warning (${snap.temperature}°C)`;
    }

    const formattedDate = formatDateInTimezone(snap.date, tz);

    const res = await createNotification(userId, {
      type: 'WEATHER_ALERT',
      title: `Weather Alert: ${snap.trip.destinationName}`,
      body: `${condition} on ${formattedDate}. Check your clothing and schedule accordingly.`,
      actionUrl: `/trips/${snap.tripId}`,
      idempotencyKey,
      data: {
        tripId: snap.tripId,
        date: snap.date.toISOString(),
        temperature: snap.temperature,
        precipitationProbability: snap.precipitationProbability,
        condition,
      },
    });

    results.push(res);
  }

  return results;
}

/**
 * 11B.1 & 11B.2: Budget Threshold Alert Evaluator
 * Evaluates if expenses exceed 80% or 100% of trip budget
 */
export async function evaluateBudgetAlerts(
  userId: string
): Promise<CreateNotificationResult[]> {
  if (!userId) throw new ValidationError('User ID is required');

  const tripsWithBudget = await prisma.trip.findMany({
    where: {
      userId,
      isArchived: false,
      budget: { isNot: null },
    },
    include: {
      budget: {
        include: {
          expenses: true,
        },
      },
    },
  });

  const results: CreateNotificationResult[] = [];

  for (const trip of tripsWithBudget) {
    const budget = trip.budget;
    if (!budget || budget.totalAmount <= 0) continue;

    const totalSpent = budget.expenses.reduce((sum, e) => sum + e.amount, 0);
    const spentPercentage = Math.round((totalSpent / budget.totalAmount) * 100);

    // Evaluate 80% threshold
    if (spentPercentage >= 80) {
      const tier = spentPercentage >= 100 ? '100_PERCENT' : '80_PERCENT';
      const idempotencyKey = `BUDGET_ALERT:${trip.id}:${tier}`;

      const title =
        spentPercentage >= 100
          ? `Budget Exceeded: ${trip.title}`
          : `Budget Warning: ${trip.title}`;

      const body = `You have spent ${budget.currency} ${totalSpent} of ${budget.currency} ${budget.totalAmount} (${spentPercentage}% of total budget).`;

      const res = await createNotification(userId, {
        type: 'BUDGET_ALERT',
        title,
        body,
        actionUrl: `/trips/${trip.id}`,
        idempotencyKey,
        data: {
          tripId: trip.id,
          totalBudget: budget.totalAmount,
          totalSpent,
          spentPercentage,
          tier,
        },
      });

      results.push(res);
    }
  }

  return results;
}

/**
 * Central evaluator for a user running all event generators
 */
export async function evaluateAllRemindersForUser(
  userId: string,
  options: ReminderEngineOptions = {}
): Promise<ReminderEvaluationSummary> {
  if (!userId) throw new ValidationError('User ID is required');

  const allResults: CreateNotificationResult[] = [];

  const tripRes = await evaluateTripReminders(userId, options);
  allResults.push(...tripRes);

  const itnRes = await evaluateItineraryReminders(userId, options);
  allResults.push(...itnRes);

  const transRes = await evaluateTransportationReminders(userId, options);
  allResults.push(...transRes);

  const weatherRes = await evaluateWeatherAlerts(userId, options);
  allResults.push(...weatherRes);

  const budgetRes = await evaluateBudgetAlerts(userId);
  allResults.push(...budgetRes);

  const notificationsGenerated = allResults.filter((r) => r.created).length;
  const duplicatesSkipped = allResults.filter((r) => r.duplicate).length;
  const disabledCategoriesSkipped = allResults.filter(
    (r) => r.reason === 'CATEGORY_DISABLED'
  ).length;

  return {
    evaluatedCategories: [
      'TRIP_UPCOMING',
      'ITINERARY_UPCOMING',
      'TRANSPORT_DEPARTURE',
      'WEATHER_ALERT',
      'BUDGET_ALERT',
    ],
    notificationsGenerated,
    duplicatesSkipped,
    disabledCategoriesSkipped,
    results: allResults,
  };
}

/**
 * 11B.5: Scheduled / Background Trigger Evaluator (Vercel Cron & Internal triggers)
 * Requires secure CRON_SECRET authorization.
 */
export async function runScheduledReminderCron(
  authSecret?: string,
  options: ReminderEngineOptions = {}
): Promise<{
  success: boolean;
  usersProcessed: number;
  totalGenerated: number;
  dueRemindersProcessed?: number;
  dueRemindersSent?: number;
}> {
  const expectedSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && !expectedSecret) {
    throw new UnauthorizedError('CRON_SECRET is not configured on this server.');
  }
  const secretToMatch = expectedSecret || 'ghumnechalo-cron-secret-2026';

  if (!authSecret || authSecret !== secretToMatch) {
    throw new UnauthorizedError('Unauthorized cron trigger: Invalid or missing authorization token.');
  }

  // Find all active users with trips (or targeted user if specified)
  const users = options.userId
    ? [{ id: options.userId }]
    : await prisma.user.findMany({
        where: {
          trips: {
            some: { isArchived: false },
          },
        },
        select: { id: true },
        take: options.limit || 50,
      });

  let totalGenerated = 0;

  for (const user of users) {
    const summary = await evaluateAllRemindersForUser(user.id, options);
    totalGenerated += summary.notificationsGenerated;
  }

  // Also process any persistent scheduled Reminder records that are due
  const { processDueReminders } = await import('@/lib/reminders/reminder-service');
  const dueResult = await processDueReminders({
    limit: options.limit || 50,
    now: options.referenceTime,
  });

  return {
    success: true,
    usersProcessed: users.length,
    totalGenerated,
    dueRemindersProcessed: dueResult.processed,
    dueRemindersSent: dueResult.sent,
  };
}

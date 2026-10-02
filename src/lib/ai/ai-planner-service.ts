import { prisma } from '../prisma';
import { NotFoundError, ValidationError } from '../api-error';
import { PlanningPreferences, GeneratedTripPlan, GeneratedDayPlan } from './types';
import { generatedTripPlanSchema } from './validation';
import {
  buildSystemPrompt,
  buildTripPlanPrompt,
  buildDayRegeneratePrompt,
  TripPromptContext,
} from './prompts';
import { generateAiTripPlan, regenerateAiDayPlan } from './gemini-client';
import { getTripWeather } from '../weather/weather-service';
import { calculateDuration } from '../itinerary-service';
import { ServerLRUCache } from '../cache/server-lru-cache';

// Bounded LRU cache for generated AI trip plans (prevents repeated duplicate Gemini invocations)
const AI_PLAN_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const AI_PLAN_MODEL_VERSION = 'v1';

const aiPlanCache = new ServerLRUCache<string, GeneratedTripPlan>({
  maxSize: 50,
  ttlMs: AI_PLAN_CACHE_TTL_MS,
  label: 'ai:plan',
});

// In-flight promise map to deduplicate simultaneous duplicate requests
const inFlightAiRequests = new Map<string, Promise<GeneratedTripPlan>>();

export function _clearAiPlanCache(): void {
  aiPlanCache.clear();
}

function buildAiPlanCacheKey(
  userId: string,
  tripId: string,
  context: TripPromptContext,
  preferences: PlanningPreferences
): string {
  const prefKey = JSON.stringify({
    travelStyle: preferences.travelStyle,
    interests: preferences.interests?.slice().sort(),
    budget: preferences.budget,
    currency: preferences.currency,
    travelers: preferences.travelers,
    paceNotes: preferences.paceNotes,
  });
  return `user:${userId}:trip:${tripId}:model:${AI_PLAN_MODEL_VERSION}:${context.destination}:${context.startDate}:${context.endDate}:${prefKey}`;
}

interface TripWithRelations {
  id: string;
  userId: string;
  destinationName: string;
  startDate: Date;
  endDate: Date;
  totalBudget: number | null;
  currency: string;
  itineraryDays: Array<{
    dayNumber: number;
    items: Array<{ name: string }>;
  }>;
  transportation: Array<{
    type: string;
    origin: string;
    destination: string;
    departureTime: Date | null;
    arrivalTime: Date | null;
  }>;
}

/**
 * Builds the comprehensive server-side prompt context for a trip.
 */
async function assembleTripContext(
  tripId: string,
  userId: string,
  preferences: PlanningPreferences = {}
): Promise<{ trip: TripWithRelations; context: TripPromptContext }> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      itineraryDays: {
        orderBy: { dayNumber: 'asc' },
        include: {
          items: { orderBy: { order: 'asc' } },
        },
      },
      transportation: {
        orderBy: { departureTime: 'asc' },
      },
    },
  });

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  if (trip.userId !== userId) {
    throw new NotFoundError('Trip not found'); // IDOR safe
  }

  const durationDays = calculateDuration(trip.startDate, trip.endDate);
  const startDateStr = trip.startDate.toISOString().split('T')[0];
  const endDateStr = trip.endDate.toISOString().split('T')[0];

  // 1 & 2 & 3. Gather Weather, Transportation & Saved Places concurrently
  const weatherPromise = getTripWeather(tripId, userId).catch(() => null);
  const savedPlacesPromise = prisma.savedPlace.findMany({
    where: { userId },
    select: { name: true },
    take: 10,
  });

  const [weather, savedPlacesRecords] = await Promise.all([weatherPromise, savedPlacesPromise]);

  let weatherSummary = '';
  const rainExpectedDays: string[] = [];
  if (weather) {
    weatherSummary = `Trip Temperature Range: ${weather.summary.tempRange}. Overall Condition: ${weather.summary.predominantCondition}. Rain Risk: ${weather.summary.maxRainChance}%.`;
    for (const d of weather.days) {
      if ((d.precipitationProbability ?? 0) >= 40) {
        rainExpectedDays.push(d.date);
      }
    }
  } else {
    weatherSummary = 'Live weather forecast currently unavailable.';
  }

  // Transportation Context (Phase 6 integration)
  const transportationSummary: string[] = trip.transportation.map((t) => {
    const dep = t.departureTime ? new Date(t.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
    const arr = t.arrivalTime ? new Date(t.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
    return `${t.type}: ${t.origin} -> ${t.destination} (Dep: ${dep}, Arr: ${arr})`;
  });
  const savedPlaces = savedPlacesRecords.map((s) => s.name);

  // 4. Gather Existing Itinerary Items
  const existingActivities: string[] = [];
  for (const day of trip.itineraryDays) {
    for (const item of day.items) {
      existingActivities.push(`Day ${day.dayNumber}: ${item.name}`);
    }
  }

  const context: TripPromptContext = {
    destination: trip.destinationName,
    startDate: startDateStr,
    endDate: endDateStr,
    durationDays,
    currency: trip.currency || 'INR',
    budget: preferences.budget ?? (trip.totalBudget ? Number(trip.totalBudget) : null),
    preferences,
    weatherSummary,
    rainExpectedDays,
    transportationSummary,
    savedPlaces,
    existingActivities,
  };

  return { trip, context };
}

/**
 * Generates an AI travel plan preview for a trip without mutating the database.
 * Uses bounded ServerLRUCache and in-flight deduplication to prevent duplicate Gemini invocations.
 */
export async function createAiTripPlan(
  tripId: string,
  userId: string,
  preferences: PlanningPreferences = {},
  options?: { forceRefresh?: boolean }
): Promise<GeneratedTripPlan> {
  const { context } = await assembleTripContext(tripId, userId, preferences);
  const cacheKey = buildAiPlanCacheKey(userId, tripId, context, preferences);

  // 1. Check bounded cache unless caller explicitly requested force refresh
  if (!options?.forceRefresh) {
    const cachedPlan = aiPlanCache.get(cacheKey);
    if (cachedPlan) {
      return cachedPlan;
    }
  }

  // 2. Deduplicate in-flight simultaneous requests with identical inputs
  if (inFlightAiRequests.has(cacheKey)) {
    return inFlightAiRequests.get(cacheKey)!;
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildTripPlanPrompt(context);

  const requestPromise = (async () => {
    try {
      const plan = await generateAiTripPlan(context, systemPrompt, userPrompt);
      // Only cache valid, completed plans
      aiPlanCache.set(cacheKey, plan);
      return plan;
    } finally {
      inFlightAiRequests.delete(cacheKey);
    }
  })();

  inFlightAiRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Regenerates an individual day within an existing trip plan.
 */
export async function regenerateAiTripDay(
  tripId: string,
  dayNumber: number,
  userId: string,
  instruction?: string,
  preferences: PlanningPreferences = {}
): Promise<GeneratedDayPlan> {
  const { trip, context } = await assembleTripContext(tripId, userId, preferences);

  if (dayNumber < 1 || dayNumber > context.durationDays) {
    throw new ValidationError(`Day number must be between 1 and ${context.durationDays}.`);
  }

  const targetDateObj = new Date(trip.startDate);
  targetDateObj.setUTCDate(targetDateObj.getUTCDate() + (dayNumber - 1));
  const targetDateStr = targetDateObj.toISOString().split('T')[0];

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildDayRegeneratePrompt(context, dayNumber, targetDateStr, instruction);

  return regenerateAiDayPlan(context, dayNumber, targetDateStr, systemPrompt, userPrompt);
}

/**
 * Transactionally applies a generated AI plan to the trip's itinerary in the database.
 */
export async function applyAiTripPlan(
  tripId: string,
  userId: string,
  rawPlan: GeneratedTripPlan,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; appliedDays: number; appliedActivities: number }> {
  // Strict schema validation before opening transaction
  const plan = generatedTripPlanSchema.parse(rawPlan);

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      itineraryDays: {
        include: { items: true },
      },
    },
  });

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  if (trip.userId !== userId) {
    throw new NotFoundError('Trip not found'); // IDOR safe
  }

  let activityCount = 0;

  await prisma.$transaction(
    async (tx) => {
      // 1. If replace mode: clear existing itinerary items
      if (mode === 'replace') {
        for (const existingDay of trip.itineraryDays) {
          await tx.itineraryItem.deleteMany({
            where: { itineraryDayId: existingDay.id },
          });
        }
      }

      // 2. Apply days and activities from plan
      for (const dayPlan of plan.days) {
        // Find or create the corresponding itinerary day
        let dayRecord = await tx.itineraryDay.findUnique({
          where: {
            tripId_dayNumber: {
              tripId,
              dayNumber: dayPlan.dayNumber,
            },
          },
        });

        if (!dayRecord) {
          dayRecord = await tx.itineraryDay.create({
            data: {
              tripId,
              dayNumber: dayPlan.dayNumber,
              date: new Date(`${dayPlan.date}T00:00:00.000Z`),
              title: dayPlan.title,
            },
          });
        } else {
          // Update day title with AI plan's title
          await tx.itineraryDay.update({
            where: { id: dayRecord.id },
            data: { title: dayPlan.title },
          });
        }

        // Determine starting order index
        const existingItemsCount = await tx.itineraryItem.count({
          where: { itineraryDayId: dayRecord.id },
        });

        // Batch insert activities in a single atomic SQL statement
        const itemsToCreate = dayPlan.activities.map((act, i) => ({
          itineraryDayId: dayRecord.id,
          name: act.name,
          placeId: act.placeId || null,
          latitude: act.latitude ?? null,
          longitude: act.longitude ?? null,
          startTime: act.startTime,
          endTime: act.endTime,
          notes: act.description
            ? `${act.description}\n\n[AI Recommendation: ${act.reasoning}]`
            : act.reasoning,
          order: existingItemsCount + i,
        }));

        if (itemsToCreate.length > 0) {
          await tx.itineraryItem.createMany({
            data: itemsToCreate,
          });
          activityCount += itemsToCreate.length;
        }
      }
    },
    {
      timeout: 30000,
      maxWait: 15000,
    }
  );

  return {
    success: true,
    appliedDays: plan.days.length,
    appliedActivities: activityCount,
  };
}

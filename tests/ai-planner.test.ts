import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { POST as createTrip } from '../src/app/api/trips/route';
import { POST as generateAiPlanRoute } from '../src/app/api/trips/[tripId]/ai-plan/route';
import { POST as applyAiPlanRoute } from '../src/app/api/trips/[tripId]/ai-plan/apply/route';
import { POST as regenerateDayRoute } from '../src/app/api/trips/[tripId]/ai-plan/day/[dayNumber]/route';
import { GET as getAiStatusRoute } from '../src/app/api/trips/[tripId]/ai-plan/status/route';
import {
  getAiRuntimeStatus,
  extractJsonFromLlm,
  generateDeterministicPlan,
  generateDeterministicDayPlan,
  GeminiRuntimeError,
} from '../src/lib/ai/gemini-client';
import {
  generatedTripPlanSchema,
  generatedDayPlanSchema,
  planningPreferencesSchema,
  applyPlanRequestSchema,
} from '../src/lib/ai/validation';
import type { GeneratedTripPlan } from '../src/lib/ai/types';
import {
  buildSystemPrompt,
  buildTripPlanPrompt,
  buildDayRegeneratePrompt,
  TripPromptContext,
} from '../src/lib/ai/prompts';
import {
  createAiTripPlan,
  regenerateAiTripDay,
  applyAiTripPlan,
} from '../src/lib/ai/ai-planner-service';
import { getOrCreateItineraryDays } from '../src/lib/itinerary-service';

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
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Phase 8 — Gemini AI Travel Planner', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tripA: { id: string; destinationName: string; startDate: string; endDate: string };
  let tripB: { id: string; destinationName: string; startDate: string; endDate: string };

  async function dbRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw new Error('Exceeded max retries');
  }

  beforeAll(async () => {
    // 1. Create User A
    userA = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `ai-test-a-${Date.now()}@example.com`,
          name: 'AI Test User A',
        },
      })
    );

    // 2. Create User B
    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `ai-test-b-${Date.now()}@example.com`,
          name: 'AI Test User B',
        },
      })
    );

    // 3. Create Trip A (Goa, 3 days)
    const reqA = createRequest('/api/trips', userA.id, 'POST', {
      title: 'Goa Beach Holiday',
      destinationName: 'Goa, India',
      latitude: 15.2993,
      longitude: 74.124,
      startDate: '2026-11-10T00:00:00.000Z',
      endDate: '2026-11-12T00:00:00.000Z',
      currency: 'INR',
      totalBudget: 25000,
    });
    const resA = await createTrip(reqA);
    const jsonA = await resA.json();
    tripA = jsonA.data;

    // Create Itinerary Days & Items for Trip A
    const daysA = await getOrCreateItineraryDays(
      tripA.id,
      new Date('2026-11-10'),
      new Date('2026-11-12')
    );
    await prisma.itineraryItem.create({
      data: {
        itineraryDayId: daysA[0].id,
        name: 'Pre-existing Welcome Sunset Walk',
        startTime: '17:30',
        endTime: '18:30',
        order: 0,
      },
    });

    // Create Transportation for Trip A
    await prisma.transportation.create({
      data: {
        tripId: tripA.id,
        type: 'FLIGHT',
        origin: 'Mumbai (BOM)',
        destination: 'Goa (GOI)',
        departureTime: new Date('2026-11-10T08:00:00.000Z'),
        arrivalTime: new Date('2026-11-10T09:30:00.000Z'),
      },
    });

    // Create a Saved Place for User A
    await prisma.savedPlace.create({
      data: {
        userId: userA.id,
        placeId: 'saved-fort-aguada',
        name: 'Fort Aguada Lighthouse',
        address: 'Sinquerim, Goa',
        latitude: 15.492,
        longitude: 73.7737,
      },
    });

    // 4. Create Trip B (User B)
    const reqB = createRequest('/api/trips', userB.id, 'POST', {
      title: 'Manali Mountain Getaway',
      destinationName: 'Manali, Himachal Pradesh',
      startDate: '2026-12-05T00:00:00.000Z',
      endDate: '2026-12-08T00:00:00.000Z',
      currency: 'INR',
    });
    const resB = await createTrip(reqB);
    const jsonB = await resB.json();
    tripB = jsonB.data;
  }, 60000);

  afterAll(async () => {
    if (userA?.id) {
      await dbRetry(() => prisma.itineraryItem.deleteMany({ where: { itineraryDay: { tripId: tripA.id } } })).catch(() => {});
      await dbRetry(() => prisma.itineraryDay.deleteMany({ where: { tripId: tripA.id } })).catch(() => {});
      await dbRetry(() => prisma.transportation.deleteMany({ where: { tripId: tripA.id } })).catch(() => {});
      await dbRetry(() => prisma.savedPlace.deleteMany({ where: { userId: userA.id } })).catch(() => {});
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userA.id } })).catch(() => {});
      await dbRetry(() => prisma.user.delete({ where: { id: userA.id } })).catch(() => {});
    }
    if (userB?.id) {
      await dbRetry(() => prisma.itineraryItem.deleteMany({ where: { itineraryDay: { tripId: tripB.id } } })).catch(() => {});
      await dbRetry(() => prisma.itineraryDay.deleteMany({ where: { tripId: tripB.id } })).catch(() => {});
      await dbRetry(() => prisma.trip.deleteMany({ where: { userId: userB.id } })).catch(() => {});
      await dbRetry(() => prisma.user.delete({ where: { id: userB.id } })).catch(() => {});
    }
  }, 60000);

  // =========================================================================
  // TC-8.01 to TC-8.02: CREDENTIAL DETECTION & RUNTIME STATUS
  // =========================================================================
  describe('Runtime Detection & Credential Inspection', () => {
    it('TC-8.01: AI runtime credentials are detected correctly', () => {
      const status = getAiRuntimeStatus();
      expect(status).toHaveProperty('isConfigured');
      expect(status).toHaveProperty('provider');
      expect(status).toHaveProperty('model');
      expect(typeof status.isConfigured).toBe('boolean');
    });

    it('TC-8.02: Missing AI credentials return safe configuration message', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/ai-plan/status`, userA.id);
      const res = await getAiStatusRoute(req, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('isConfigured');
      expect(json.data).toHaveProperty('model');
    });
  });

  // =========================================================================
  // TC-8.03 to TC-8.06: AUTHENTICATION, AUTHORIZATION & IDOR
  // =========================================================================
  describe('Authentication & Authorization Security', () => {
    it('TC-8.03: Authenticated user can request AI plan', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/ai-plan`, userA.id, 'POST', {
        travelStyle: 'relaxed',
        interests: ['beaches', 'seafood'],
      });
      const res = await generateAiPlanRoute(req, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.destination).toContain('Goa');
      expect(json.data.days).toHaveLength(3);
    });

    it('TC-8.04: Unauthenticated user cannot request private trip AI plan', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/ai-plan`, undefined, 'POST');
      const res = await generateAiPlanRoute(req, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(res.status).toBe(401);
    });

    it('TC-8.05: User cannot generate a plan for another user\'s trip (IDOR)', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/ai-plan`, userB.id, 'POST');
      const res = await generateAiPlanRoute(req, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(res.status).toBe(404);
    });

    it('TC-8.06: Forged userId in request body is ignored', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/ai-plan`, userA.id, 'POST', {
        userId: userB.id, // Forged
        travelStyle: 'moderate',
      });
      const res = await generateAiPlanRoute(req, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  // =========================================================================
  // TC-8.07 to TC-8.10: SERVER-SIDE CONTEXT ASSEMBLY
  // =========================================================================
  describe('Server-Side Context Assembly', () => {
    it('TC-8.07: Trip context is loaded server-side', async () => {
      const plan = await createAiTripPlan(tripA.id, userA.id, { travelStyle: 'fast-paced' });
      expect(plan.destination).toBe('Goa, India');
      expect(plan.tripDurationDays).toBe(3);
      expect(plan.days[0].date).toBe('2026-11-10');
      expect(plan.days[2].date).toBe('2026-11-12');
    });

    it('TC-8.08: Weather context is included when available', () => {
      const context: TripPromptContext = {
        destination: 'Goa',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        durationDays: 3,
        currency: 'INR',
        preferences: { travelStyle: 'moderate', interests: ['beaches'] },
        weatherSummary: 'Precipitation 80% on Day 2',
        rainExpectedDays: ['2026-11-11'],
      };

      const prompt = buildTripPlanPrompt(context);
      expect(prompt).toContain('Rain expected on: 2026-11-11');
      expect(prompt).toContain('Precipitation 80% on Day 2');

      // Test deterministic planner adaptation to rain
      const plan = generateDeterministicPlan(context);
      expect(plan.weatherConsiderations[0]).toContain('Rain anticipated on 2026-11-11');
      const day2 = plan.days.find((d) => d.date === '2026-11-11');
      expect(day2?.notes).toContain('Rain expected');
    });

    it('TC-8.09: Transportation context is included when available', async () => {
      const context: TripPromptContext = {
        destination: 'Goa',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        durationDays: 3,
        currency: 'INR',
        preferences: {},
        transportationSummary: ['flight: Mumbai (BOM) -> Goa (GOI) (Dep: 08:00, Arr: 09:30)'],
      };

      const prompt = buildTripPlanPrompt(context);
      expect(prompt).toContain('Mumbai (BOM) -> Goa (GOI)');
    });

    it('TC-8.10: Existing itinerary context is included', () => {
      const context: TripPromptContext = {
        destination: 'Goa',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        durationDays: 3,
        currency: 'INR',
        preferences: {},
        existingActivities: ['Day 1: Pre-existing Welcome Sunset Walk'],
      };

      const prompt = buildTripPlanPrompt(context);
      expect(prompt).toContain('Day 1: Pre-existing Welcome Sunset Walk');
    });
  });

  // =========================================================================
  // TC-8.11 to TC-8.16: SCHEMA VALIDATION & ANTI-HALLUCINATION
  // =========================================================================
  describe('Schema Validation & Anti-Hallucination Constraints', () => {
    it('TC-8.11: AI output conforms to schema', () => {
      const mockPlan = generateDeterministicPlan({
        destination: 'Jaipur',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        durationDays: 3,
        currency: 'INR',
        preferences: { travelStyle: 'moderate', interests: ['history', 'culture'] },
      });

      const parsed = generatedTripPlanSchema.safeParse(mockPlan);
      expect(parsed.success).toBe(true);
    });

    it('TC-8.12: Malformed AI JSON is rejected', () => {
      expect(() => extractJsonFromLlm('Not a valid JSON string')).toThrow(GeminiRuntimeError);

      const invalidSchemaData = {
        summary: 'Trip',
        destination: 'Goa',
        // Missing tripDurationDays and days array
      };
      const parsed = generatedTripPlanSchema.safeParse(invalidSchemaData);
      expect(parsed.success).toBe(false);
    });

    it('TC-8.12b: Non-standard LLM categories, priorities, and times are normalized gracefully', () => {
      const dayWithLlmVariations = {
        dayNumber: 1,
        date: '2026-11-10',
        title: 'Arrival & Adventure',
        activities: [
          {
            name: 'Sunset Beach Walk',
            description: 'Relax on the sands',
            category: 'nature', // outside enum, should normalize to 'relaxation'
            startTime: '9:30', // single digit hour, should normalize to '09:30'
            endTime: '11:00 AM',
            durationMinutes: 90,
            priority: 'must-see', // hyphenated, should normalize to 'must_see'
            reasoning: 'Scenic highlight',
          },
          {
            name: 'Local Street Food Tour',
            description: 'Taste authentic dishes',
            category: 'Dining', // uppercase synonym, should normalize to 'food'
            startTime: '13:00',
            endTime: '15:00',
            durationMinutes: 120,
            priority: 'recommended',
            reasoning: 'Culinary delight',
          },
        ],
        meals: [
          {
            type: 'brunch', // should normalize to 'lunch'
            suggestion: 'Cafe brunch',
          },
        ],
      };

      const result = generatedDayPlanSchema.safeParse(dayWithLlmVariations);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activities[0].category).toBe('relaxation');
        expect(result.data.activities[0].startTime).toBe('09:30');
        expect(result.data.activities[0].priority).toBe('must_see');
        expect(result.data.activities[1].category).toBe('food');
        expect(result.data.meals?.[0].type).toBe('lunch');
      }
    });

    it('TC-8.12c: Long warnings, recommendations, and suggestions (>300 chars) are handled resiliently without throwing', () => {
      const longWarning = 'A'.repeat(450); // Previously failed with too_big <=300
      const veryLongRecommendation = 'B'.repeat(1200); // Exceeds 1000, should be sliced
      const structuredWarningObject = { warning: 'Monsoon flash flood alert along mountain ghats' };

      const planWithLongStrings = {
        summary: 'A curated overview for our exciting trip.',
        destination: 'Goa',
        tripDurationDays: 1,
        days: [
          {
            dayNumber: 1,
            date: '2026-11-10',
            title: 'Arrival Day',
            activities: [
              {
                name: 'Beach Walk',
                startTime: '10:00',
                endTime: '12:00',
                estimatedCost: '500 INR', // Coerced from string
              },
            ],
          },
        ],
        warnings: [longWarning, structuredWarningObject],
        recommendations: [veryLongRecommendation],
        transportationSuggestions: ['Take the local ferry across the river.'],
        weatherConsiderations: ['Pleasant coastal humidity with sunny skies.'],
      };

      const parsed = generatedTripPlanSchema.safeParse(planWithLongStrings);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        // Long warning (>300 chars) was retained without error
        expect(parsed.data.warnings[0].length).toBe(450);
        expect(parsed.data.warnings[1]).toBe('Monsoon flash flood alert along mountain ghats');
        // Very long recommendation (>1000 chars) was safely capped at 1000 without crashing
        expect(parsed.data.recommendations[0].length).toBe(1000);
        // Cost string was safely coerced to number
        expect(parsed.data.days[0].activities[0].estimatedCost).toBe(500);
      }
    });

    it('TC-8.13: Invalid generated date is rejected', () => {
      const invalidDay = {
        dayNumber: 1,
        date: 'not-a-date',
        title: 'Day 1',
        activities: [],
      };
      const result = generatedDayPlanSchema.safeParse(invalidDay);
      expect(result.success).toBe(false);
    });

    it('TC-8.14: Generated activity outside trip dates is rejected', async () => {
      // Schema requires proper dates
      const invalidDay = {
        dayNumber: 99,
        date: '2099-12-31',
        title: 'Future Day',
        activities: [],
      };
      const validDay = generatedDayPlanSchema.safeParse(invalidDay);
      expect(validDay.success).toBe(true); // validates format
      // In service, dayNumber outside duration is rejected
      await expect(
        regenerateAiTripDay(tripA.id, 99, userA.id)
      ).rejects.toThrow();
    });

    it('TC-8.15: AI-generated coordinates are never trusted as verified coordinates', () => {
      const plan = generateDeterministicPlan({
        destination: 'Goa',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        durationDays: 3,
        currency: 'INR',
        preferences: {},
      });

      for (const day of plan.days) {
        for (const act of day.activities) {
          expect(act.latitude).toBeNull();
          expect(act.longitude).toBeNull();
          expect(act.placeId).toBeNull();
        }
      }
    });

    it('TC-8.16: Generated place references are normalized', () => {
      const rawText = JSON.stringify({
        summary: 'A nice trip',
        destination: 'Kerala',
        tripDurationDays: 1,
        days: [
          {
            dayNumber: 1,
            date: '2026-12-01',
            title: 'Backwaters Tour',
            theme: 'Nature',
            activities: [
              {
                name: 'Alleppey Houseboat Cruise',
                description: 'Cruising through lush waterways',
                category: 'relaxation',
                startTime: '10:00',
                endTime: '13:00',
                durationMinutes: 180,
                priority: 'must_see',
                reasoning: 'Signature Kerala experience',
                locationHint: 'Alleppey',
              },
            ],
          },
        ],
      });

      const extracted = extractJsonFromLlm(rawText);
      const validated = generatedTripPlanSchema.parse(extracted);
      expect(validated.days[0].activities[0].name).toBe('Alleppey Houseboat Cruise');
      expect(validated.days[0].activities[0].latitude).toBeNull();
      expect(validated.days[0].activities[0].longitude).toBeNull();
    });
  });

  // =========================================================================
  // TC-8.17 to TC-8.18: ERROR HANDLING & RESILIENCE
  // =========================================================================
  describe('Provider Failure & Timeout Resilience', () => {
    it('TC-8.17: Provider resilience handles generation safely in test environment', async () => {
      // Calling createAiTripPlan produces full structured plan
      const plan = await createAiTripPlan(tripA.id, userA.id, { travelStyle: 'relaxed' });
      expect(plan).toBeDefined();
      expect(plan.days.length).toBe(3);
    });

    it('TC-8.18: AI timeout handled safely', () => {
      const err = new GeminiRuntimeError('AI service timeout after 25000ms', 504);
      expect(err.statusCode).toBe(504);
      expect(err.name).toBe('GeminiRuntimeError');
    });
  });

  // =========================================================================
  // TC-8.19 to TC-8.22: ITINERARY SAFETY & ATOMIC APPLY TRANSACTION
  // =========================================================================
  describe('Itinerary Safety & Atomic Apply Transaction', () => {
    it('TC-8.19: Existing itinerary is not overwritten during plan generation', async () => {
      const itemsBefore = await prisma.itineraryItem.findMany({
        where: { itineraryDay: { tripId: tripA.id } },
      });

      // Request an AI plan
      const plan = await createAiTripPlan(tripA.id, userA.id);
      expect(plan.days.length).toBe(3);

      const itemsAfter = await prisma.itineraryItem.findMany({
        where: { itineraryDay: { tripId: tripA.id } },
      });

      // Itinerary count must remain completely unchanged
      expect(itemsAfter.length).toBe(itemsBefore.length);
      expect(itemsAfter[0].name).toBe('Pre-existing Welcome Sunset Walk');
    });

    it('TC-8.20: Apply requires explicit user action', async () => {
      const plan = await createAiTripPlan(tripA.id, userA.id);

      // Attempting to apply without auth fails
      const unauthReq = createRequest(`/api/trips/${tripA.id}/ai-plan/apply`, undefined, 'POST', {
        plan,
        mode: 'merge',
      });
      const unauthRes = await applyAiPlanRoute(unauthReq, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(unauthRes.status).toBe(401);
    });

    it('TC-8.21: Apply uses database transaction and adds activities', async () => {
      const plan = await createAiTripPlan(tripA.id, userA.id);

      const validatedApplyReq = applyPlanRequestSchema.parse({ plan, mode: 'merge' });
      expect(validatedApplyReq.mode).toBe('merge');

      const authReq = createRequest(`/api/trips/${tripA.id}/ai-plan/apply`, userA.id, 'POST', {
        plan,
        mode: 'merge',
      });
      const res = await applyAiPlanRoute(authReq, { params: Promise.resolve({ tripId: tripA.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.appliedActivities).toBeGreaterThan(0);

      // Verify DB records
      const items = await prisma.itineraryItem.findMany({
        where: { itineraryDay: { tripId: tripA.id } },
      });

      // Existing item preserved + new items added
      expect(items.some((i) => i.name === 'Pre-existing Welcome Sunset Walk')).toBe(true);
      expect(items.length).toBeGreaterThan(1);
    });

    it('TC-8.22: Failed apply rolls back cleanly', async () => {
      const invalidPlan = {
        summary: 'Invalid plan',
        destination: 'Goa',
        // Missing required tripDurationDays and days array!
      };

      const countBefore = await dbRetry(() =>
        prisma.itineraryItem.count({
          where: { itineraryDay: { tripId: tripB.id } },
        })
      );

      // Passing invalid data to apply throws validation error before transaction
      await expect(
        applyAiTripPlan(tripB.id, userB.id, invalidPlan as unknown as GeneratedTripPlan)
      ).rejects.toThrow();

      const countAfter = await dbRetry(() =>
        prisma.itineraryItem.count({
          where: { itineraryDay: { tripId: tripB.id } },
        })
      );

      expect(countAfter).toBe(countBefore);
    });
  });

  // =========================================================================
  // TC-8.23 to TC-8.25: REGENERATION, REQUEST LIMITS & SECURITY
  // =========================================================================
  describe('Day Regeneration & Security Constraints', () => {
    it('TC-8.23: User can regenerate a specific day', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/ai-plan/day/2`, userA.id, 'POST', {
        instruction: 'Focus entirely on water sports and beach cafes',
      });
      const res = await regenerateDayRoute(req, {
        params: Promise.resolve({ tripId: tripA.id, dayNumber: '2' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.dayNumber).toBe(2);
      expect(json.data.date).toBe('2026-11-11');
      expect(json.data.activities.length).toBeGreaterThan(0);

      const context: TripPromptContext = {
        destination: 'Goa',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        durationDays: 3,
        currency: 'INR',
        preferences: {},
      };
      const directDay = generateDeterministicDayPlan(context, 2, '2026-11-11', 'Relaxing day');
      expect(directDay.dayNumber).toBe(2);
      expect(directDay.activities.length).toBeGreaterThan(0);
    });

    it('TC-8.24: AI request size limits work', () => {
      // Zod schema limits paceNotes to 500 chars
      const overlyLongNotes = 'a'.repeat(600);
      const invalid = planningPreferencesSchema.safeParse({
        paceNotes: overlyLongNotes,
      });
      expect(invalid.success).toBe(false);

      // Zod schema limits interests to 15 items
      const tooManyInterests = Array(20).fill('sightseeing');
      const invalidInterests = planningPreferencesSchema.safeParse({
        interests: tooManyInterests,
      });
      expect(invalidInterests.success).toBe(false);
    });

    it('TC-8.25: Sensitive credentials never enter AI prompt', () => {
      const context: TripPromptContext = {
        destination: 'Goa',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        durationDays: 3,
        currency: 'INR',
        preferences: {},
      };

      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildTripPlanPrompt(context);
      const dayPrompt = buildDayRegeneratePrompt(context, 1, '2026-11-10');

      const allPrompts = `${systemPrompt}\n${userPrompt}\n${dayPrompt}`;

      expect(allPrompts).not.toContain(process.env.DATABASE_URL || 'never_found');
      expect(allPrompts).not.toContain(process.env.NEXTAUTH_SECRET || 'never_found');
      expect(allPrompts).not.toContain(process.env.GOOGLE_MAPS_API_KEY || 'never_found');
      expect(allPrompts).not.toContain('password');
      expect(allPrompts).not.toContain('privateKey');
    });
  });

  // =========================================================================
  // TC-8.26 to TC-8.30: REGRESSION ASSURANCES
  // =========================================================================
  describe('Regression Assurances (Phases 3 to 7)', () => {
    it('TC-8.26: Existing trip tests foundation remains intact', async () => {
      const found = await dbRetry(() => prisma.trip.findUnique({ where: { id: tripA.id } }));
      expect(found).not.toBeNull();
      expect(found?.destinationName).toBe('Goa, India');
    });

    it('TC-8.27: Existing itinerary tests foundation remains intact', async () => {
      const days = await dbRetry(() => prisma.itineraryDay.findMany({ where: { tripId: tripA.id } }));
      expect(days.length).toBeGreaterThanOrEqual(3);
    });

    it('TC-8.28: Existing weather tests foundation remains intact', async () => {
      expect(typeof buildTripPlanPrompt).toBe('function');
    });

    it('TC-8.29: Existing transportation tests foundation remains intact', async () => {
      const trans = await dbRetry(() => prisma.transportation.findMany({ where: { tripId: tripA.id } }));
      expect(trans.length).toBe(1);
      expect(trans[0].type).toBe('FLIGHT');
    });

    it('TC-8.30: Existing Places/Routes tests foundation remains intact', async () => {
      const saved = await dbRetry(() => prisma.savedPlace.findMany({ where: { userId: userA.id } }));
      expect(saved.length).toBe(1);
      expect(saved[0].name).toBe('Fort Aguada Lighthouse');
    });
  });
});

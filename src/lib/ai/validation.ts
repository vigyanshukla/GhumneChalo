import { z } from 'zod';

import { ActivityCategory, ActivityPriority, TravelStyle } from './types';

const VALID_CATEGORIES = [
  'sightseeing',
  'food',
  'activity',
  'relaxation',
  'travel',
  'culture',
  'shopping',
] as const;

export function normalizeActivityCategory(raw: unknown): ActivityCategory {
  if (typeof raw !== 'string') return 'sightseeing';
  const val = raw.trim().toLowerCase();
  if ((VALID_CATEGORIES as readonly string[]).includes(val)) {
    return val as ActivityCategory;
  }
  if (/food|dining|restaurant|meal|lunch|dinner|breakfast|culinary|cafe|bar|snack|drink|tasting/.test(val)) {
    return 'food';
  }
  if (/culture|cultural|history|historic|historical|museum|heritage|temple|monument|art|architecture|church|mosque|palace/.test(val)) {
    return 'culture';
  }
  if (/relax|relaxation|leisure|spa|beach|wellness|park|chill|resort|nature|garden|lake/.test(val)) {
    return 'relaxation';
  }
  if (/shop|shopping|market|bazaar|souvenir|mall|store|boutique/.test(val)) {
    return 'shopping';
  }
  if (/travel|transport|transportation|transit|commute|flight|train|bus|ferry|transfer|drive|car/.test(val)) {
    return 'travel';
  }
  if (/activity|adventure|sport|hike|hiking|trek|trekking|entertainment|nightlife|outdoor|ride|safari|amusement/.test(val)) {
    return 'activity';
  }
  return 'sightseeing';
}

export const activityCategorySchema = z.preprocess(
  normalizeActivityCategory,
  z.enum(VALID_CATEGORIES)
);

const VALID_PRIORITIES = ['must_see', 'recommended', 'optional'] as const;

export function normalizeActivityPriority(raw: unknown): ActivityPriority {
  if (typeof raw !== 'string') return 'recommended';
  const val = raw.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  if ((VALID_PRIORITIES as readonly string[]).includes(val)) {
    return val as ActivityPriority;
  }
  if (/must|high|essential|top|critical/.test(val)) return 'must_see';
  if (/opt|low|extra|bonus/.test(val)) return 'optional';
  return 'recommended';
}

export const activityPrioritySchema = z.preprocess(
  normalizeActivityPriority,
  z.enum(VALID_PRIORITIES)
);

function normalizeTimeString(raw: unknown, defaultTime: string): string {
  if (typeof raw !== 'string') return defaultTime;
  const trimmed = raw.trim();
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
    return trimmed;
  }
  const singleDigitMatch = trimmed.match(/^(\d):([0-5]\d)$/);
  if (singleDigitMatch) {
    return `0${singleDigitMatch[1]}:${singleDigitMatch[2]}`;
  }
  const ampmMatch = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const ampm = ampmMatch[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  return defaultTime;
}

export const travelStyleSchema = z.enum(['relaxed', 'moderate', 'fast-paced', 'luxury', 'budget']);

export const planningPreferencesSchema = z.object({
  travelStyle: travelStyleSchema.default('moderate'),
  interests: z.array(z.string().trim().max(50)).max(15).default([]),
  budget: z.number().min(0).max(100000000).optional().nullable(),
  currency: z.string().length(3).default('INR'),
  travelers: z.number().int().min(1).max(50).default(1),
  paceNotes: z.string().trim().max(500).optional().nullable(),
});

export const generatedActivitySchema = z.object({
  id: z.string().optional().default(() => `act-${Math.random().toString(36).substring(2, 9)}`),
  name: z.string().trim().min(1, 'Activity name is required').max(150),
  description: z.string().trim().default(''),
  category: activityCategorySchema.default('sightseeing'),
  startTime: z.preprocess(
    (val) => normalizeTimeString(val, '10:00'),
    z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
  ).default('10:00'),
  endTime: z.preprocess(
    (val) => normalizeTimeString(val, '12:00'),
    z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
  ).default('12:00'),
  durationMinutes: z.coerce.number().int().min(15).max(720).default(120),
  estimatedCost: z.number().min(0).max(1000000).optional().nullable().default(null),
  priority: activityPrioritySchema.default('recommended'),
  reasoning: z.string().trim().default('Curated highlight'),
  locationHint: z.string().trim().max(100).optional(),
  placeId: z.string().trim().max(255).optional().nullable(),
  latitude: z.number().nullable().optional().default(null),
  longitude: z.number().nullable().optional().default(null),
});

export const generatedMealSchema = z.object({
  type: z.preprocess((val) => {
    if (typeof val !== 'string') return 'dinner';
    const lower = val.toLowerCase().trim();
    if (lower === 'breakfast' || lower === 'lunch' || lower === 'dinner') return lower;
    if (/morn|break/i.test(lower)) return 'breakfast';
    if (/noon|mid|lunch|brunch/i.test(lower)) return 'lunch';
    return 'dinner';
  }, z.enum(['breakfast', 'lunch', 'dinner'])).default('dinner'),
  suggestion: z.string().trim().min(1).max(200),
  estimatedCost: z.number().min(0).max(100000).optional().nullable(),
});

export const generatedDayPlanSchema = z.object({
  dayNumber: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  title: z.string().trim().min(1, 'Day title required').max(150),
  theme: z.string().trim().max(100).optional(),
  activities: z.array(generatedActivitySchema).default([]),
  meals: z.array(generatedMealSchema).optional().default([]),
  notes: z.string().trim().max(1000).optional(),
});

export const generatedTripPlanSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  destination: z.string().trim().min(1).max(150),
  tripDurationDays: z.number().int().min(1).max(60),
  days: z.array(generatedDayPlanSchema).min(1, 'Itinerary must contain at least one day'),
  recommendations: z.array(z.string().trim().max(300)).default([]),
  transportationSuggestions: z.array(z.string().trim().max(300)).default([]),
  weatherConsiderations: z.array(z.string().trim().max(300)).default([]),
  warnings: z.array(z.string().trim().max(300)).default([]),
  generatedAt: z.string().default(() => new Date().toISOString()),
  modelUsed: z.string().default('gemini-2.5-flash'),
  isVerified: z.boolean().default(true),
});

export const applyPlanRequestSchema = z.object({
  plan: generatedTripPlanSchema,
  mode: z.enum(['merge', 'replace']).default('merge'),
});

export const regenerateDayRequestSchema = z.object({
  instruction: z.string().trim().max(500).optional(),
  preferences: planningPreferencesSchema.optional(),
});

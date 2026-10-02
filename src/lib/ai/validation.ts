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

export function normalizeEstimatedCost(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return isNaN(raw) ? null : Math.max(0, Math.min(raw, 10000000));
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.max(0, Math.min(num, 10000000));
  }
  return null;
}

export function normalizeStringArray(raw: unknown, maxItemLength = 1000): string[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return [raw.trim().slice(0, maxItemLength)];
    }
    return [];
  }
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const textVal =
          (item as Record<string, unknown>).warning ||
          (item as Record<string, unknown>).recommendation ||
          (item as Record<string, unknown>).suggestion ||
          (item as Record<string, unknown>).tip ||
          (item as Record<string, unknown>).text ||
          (item as Record<string, unknown>).message ||
          (item as Record<string, unknown>).description ||
          JSON.stringify(item);
        return String(textVal).trim();
      }
      return String(item ?? '').trim();
    })
    .filter((s) => s.length > 0)
    .map((s) => (s.length > maxItemLength ? s.slice(0, maxItemLength) : s));
}

export const resilientStringArraySchema = (maxItemLength = 1000) =>
  z.preprocess(
    (val) => normalizeStringArray(val, maxItemLength),
    z.array(z.string().trim().max(maxItemLength))
  ).default([]);

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
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 200) || 'Activity' : 'Activity'),
    z.string().trim().min(1, 'Activity name is required').max(200)
  ),
  description: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 2000) : ''),
    z.string().trim().default('')
  ),
  category: activityCategorySchema.default('sightseeing'),
  startTime: z.preprocess(
    (val) => normalizeTimeString(val, '10:00'),
    z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
  ).default('10:00'),
  endTime: z.preprocess(
    (val) => normalizeTimeString(val, '12:00'),
    z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
  ).default('12:00'),
  durationMinutes: z.preprocess((val) => {
    const n = Number(val);
    return isNaN(n) ? 120 : Math.max(15, Math.min(n, 720));
  }, z.number().int()).default(120),
  estimatedCost: z.preprocess(normalizeEstimatedCost, z.number().min(0).max(10000000).optional().nullable()).default(null),
  priority: activityPrioritySchema.default('recommended'),
  reasoning: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 1000) : 'Curated highlight'),
    z.string().trim().default('Curated highlight')
  ),
  locationHint: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 200) : undefined),
    z.string().trim().max(200).optional()
  ),
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
  suggestion: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 300) || 'Local dining specialty' : 'Local dining specialty'),
    z.string().trim().min(1).max(300)
  ),
  estimatedCost: z.preprocess(normalizeEstimatedCost, z.number().min(0).max(10000000).optional().nullable()).default(null),
});

export const generatedDayPlanSchema = z.object({
  dayNumber: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  title: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 200) || 'Day Itinerary' : 'Day Itinerary'),
    z.string().trim().min(1, 'Day title required').max(200)
  ),
  theme: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 200) : undefined),
    z.string().trim().max(200).optional()
  ),
  activities: z.array(generatedActivitySchema).default([]),
  meals: z.array(generatedMealSchema).optional().default([]),
  notes: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 2000) : undefined),
    z.string().trim().max(2000).optional()
  ),
});

export const generatedTripPlanSchema = z.object({
  summary: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 2000) || 'Custom AI curated trip plan.' : 'Custom AI curated trip plan.'),
    z.string().trim().min(1).max(2000)
  ).default('Custom AI curated trip plan.'),
  destination: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().slice(0, 200) || 'Destination' : 'Destination'),
    z.string().trim().min(1).max(200)
  ),
  tripDurationDays: z.coerce.number().int().min(1).max(60),
  days: z.array(generatedDayPlanSchema).min(1, 'Itinerary must contain at least one day'),
  recommendations: resilientStringArraySchema(1000),
  transportationSuggestions: resilientStringArraySchema(1000),
  weatherConsiderations: resilientStringArraySchema(1000),
  warnings: resilientStringArraySchema(1000),
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

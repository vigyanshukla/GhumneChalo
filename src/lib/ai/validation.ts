import { z } from 'zod';

export const activityCategorySchema = z.enum([
  'sightseeing',
  'food',
  'activity',
  'relaxation',
  'travel',
  'culture',
  'shopping',
]);

export const activityPrioritySchema = z.enum(['must_see', 'recommended', 'optional']);

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
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default('10:00'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default('12:00'),
  durationMinutes: z.number().int().min(15).max(720).default(120),
  estimatedCost: z.number().min(0).max(1000000).optional().nullable().default(null),
  priority: activityPrioritySchema.default('recommended'),
  reasoning: z.string().trim().default('Curated highlight'),
  locationHint: z.string().trim().max(100).optional(),
  placeId: z.string().trim().max(255).optional().nullable(),
  latitude: z.number().nullable().optional().default(null),
  longitude: z.number().nullable().optional().default(null),
});

export const generatedMealSchema = z.object({
  type: z.enum(['breakfast', 'lunch', 'dinner']),
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

/**
 * Gemini AI Travel Planner Types & Domain Contracts (Phase 8)
 */

export type TravelStyle = 'relaxed' | 'moderate' | 'fast-paced' | 'luxury' | 'budget';

export type ActivityCategory =
  | 'sightseeing'
  | 'food'
  | 'activity'
  | 'relaxation'
  | 'travel'
  | 'culture'
  | 'shopping';

export type ActivityPriority = 'must_see' | 'recommended' | 'optional';

export interface PlanningPreferences {
  travelStyle?: TravelStyle;
  interests?: string[];
  budget?: number | null;
  currency?: string;
  travelers?: number;
  paceNotes?: string | null;
}

export interface GeneratedActivity {
  id: string; // client-safe local id
  name: string;
  description: string;
  category: ActivityCategory;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  estimatedCost: number | null;
  priority: ActivityPriority;
  reasoning: string;
  locationHint?: string;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GeneratedMealSuggestion {
  type: 'breakfast' | 'lunch' | 'dinner';
  suggestion: string;
  estimatedCost?: number | null;
}

export interface GeneratedDayPlan {
  dayNumber: number;
  date: string; // YYYY-MM-DD
  title: string;
  theme?: string;
  activities: GeneratedActivity[];
  meals?: GeneratedMealSuggestion[];
  notes?: string;
}

export interface GeneratedTripPlan {
  summary: string;
  destination: string;
  tripDurationDays: number;
  days: GeneratedDayPlan[];
  recommendations: string[];
  transportationSuggestions: string[];
  weatherConsiderations: string[];
  warnings: string[];
  generatedAt: string;
  modelUsed: string;
  isVerified: boolean;
}

export interface AiRuntimeStatus {
  isConfigured: boolean;
  provider: 'gemini_api' | 'vertex_ai' | 'none';
  model: string;
  error?: string;
}

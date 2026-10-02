import { PlanningPreferences } from './types';

export interface TripPromptContext {
  destination: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  currency: string;
  budget?: number | null;
  preferences: PlanningPreferences;
  weatherSummary?: string;
  rainExpectedDays?: string[];
  transportationSummary?: string[];
  savedPlaces?: string[];
  existingActivities?: string[];
}

export function buildSystemPrompt(): string {
  return `You are the GhumneChalo AI Travel Planner, an intelligent, culturally-astute itinerary advisor specializing in India and global travel destinations.

CRITICAL PRODUCT RULES:
1. OUTPUT FORMAT: Respond ONLY with valid, RFC 8259 JSON matching the exact schema specified in the user prompt. Do NOT wrap output in markdown code blocks (\`\`\`json or \`\`\`). Do NOT include explanatory conversational text outside the JSON.
2. DATES: Every activity must fall strictly within the provided trip dates. Never invent dates outside the range.
3. ANTI-HALLUCINATION:
   - Do NOT invent verified GPS coordinates. Set latitude and longitude to null.
   - Do NOT invent specific opening/closing hours as verified facts. Use reasonable estimated visit windows.
   - Do NOT claim booking availability or live ticket prices.
   - Clearly describe activities as curated suggestions.
4. ROUTE EFFICIENCY: Group activities geographically within each day. Avoid recommending distant locations that require zig-zagging back and forth across large regions.
5. WEATHER ADAPTATION: If the weather forecast indicates high rain probability on a day, prioritize indoor attractions, museums, heritage sites, or covered dining. On clear days, schedule outdoor sightseeing, beaches, or walking tours.
6. TRANSPORTATION CONSTRAINTS: Respect arrival and departure times from known transportation legs. Do not schedule morning activities if the traveler arrives in the afternoon.`;
}

export function buildTripPlanPrompt(context: TripPromptContext): string {
  return `Create a comprehensive day-by-day travel plan for the following trip:

=== TRIP CONTEXT ===
- Destination: ${context.destination}
- Dates: ${context.startDate} to ${context.endDate} (${context.durationDays} days)
- Travel Style: ${context.preferences.travelStyle || 'moderate'}
- Interests: ${context.preferences.interests?.length ? context.preferences.interests.join(', ') : 'Popular highlights, sightseeing, local food, culture'}
${context.budget ? `- Budget: ${context.currency} ${context.budget}` : ''}
${context.preferences.travelers ? `- Travelers: ${context.preferences.travelers}` : ''}

=== METEOROLOGICAL CONTEXT ===
${context.weatherSummary || 'No live forecast available; plan assuming normal seasonal conditions.'}
${context.rainExpectedDays?.length ? `Rain expected on: ${context.rainExpectedDays.join(', ')} (schedule indoor/sheltered activities on these days).` : ''}

=== TRANSPORTATION CONTEXT ===
${context.transportationSummary?.length ? context.transportationSummary.join('\n') : 'No arrival/departure journeys recorded yet.'}

=== USER'S SAVED PLACES (PRIORITIZE WHERE APPROPRIATE) ===
${context.savedPlaces?.length ? context.savedPlaces.join(', ') : 'None saved.'}

=== EXISTING ITINERARY ITEMS (PRESERVE CONTEXT) ===
${context.existingActivities?.length ? context.existingActivities.join('\n') : 'No activities planned yet.'}

=== REQUIRED JSON SCHEMA ===
{
  "summary": "2-3 sentence overview of this itinerary tailored to the travel style",
  "destination": "${context.destination}",
  "tripDurationDays": ${context.durationDays},
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "Descriptive day title e.g. Arrival & Historic Forts",
      "theme": "Theme e.g. Heritage & Coastal Sunset",
      "activities": [
        {
          "name": "Activity or Place name",
          "description": "Engaging description with practical tips",
          "category": "sightseeing | food | activity | relaxation | travel | culture | shopping",
          "startTime": "09:30",
          "endTime": "11:30",
          "durationMinutes": 120,
          "estimatedCost": 250,
          "priority": "must_see | recommended | optional",
          "reasoning": "Why this is recommended for this traveler",
          "locationHint": "Area or neighborhood"
        }
      ],
      "meals": [
        {
          "type": "breakfast | lunch | dinner",
          "suggestion": "Recommended dining or cuisine specialty",
          "estimatedCost": 400
        }
      ],
      "notes": "Practical tips or transit advice for the day"
    }
  ],
  "recommendations": ["Key recommendation 1", "Key recommendation 2"],
  "transportationSuggestions": ["Transit tip 1", "Transit tip 2"],
  "weatherConsiderations": ["Weather tip 1", "Weather tip 2"],
  "warnings": ["Caution or travel advice"]
}`;
}

export function buildDayRegeneratePrompt(
  context: TripPromptContext,
  dayNumber: number,
  targetDate: string,
  userInstruction?: string
): string {
  return `Regenerate ONLY Day ${dayNumber} (${targetDate}) for the trip to ${context.destination}.

Trip Context:
- Style: ${context.preferences.travelStyle || 'moderate'}
- Interests: ${context.preferences.interests?.join(', ') || 'General sightseeing'}
${context.weatherSummary ? `- Weather: ${context.weatherSummary}` : ''}
${userInstruction ? `- Specific User Request: "${userInstruction}"` : ''}

Respond with pure JSON matching this single Day schema:
{
  "dayNumber": ${dayNumber},
  "date": "${targetDate}",
  "title": "Fresh day title",
  "theme": "Day theme",
  "activities": [
    {
      "name": "Activity name",
      "description": "Description",
      "category": "sightseeing | food | activity | relaxation | travel | culture | shopping",
      "startTime": "09:00",
      "endTime": "11:00",
      "durationMinutes": 120,
      "estimatedCost": 200,
      "priority": "must_see | recommended | optional",
      "reasoning": "Reason",
      "locationHint": "Area"
    }
  ],
  "meals": [
    {
      "type": "breakfast | lunch | dinner",
      "suggestion": "Meal suggestion",
      "estimatedCost": 350
    }
  ],
  "notes": "Day notes"
}`;
}

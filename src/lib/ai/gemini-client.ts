import crypto from 'crypto';
import {
  AiRuntimeStatus,
  GeneratedTripPlan,
  GeneratedDayPlan,
  ActivityCategory,
  ActivityPriority,
} from './types';
import { generatedTripPlanSchema, generatedDayPlanSchema } from './validation';
import { TripPromptContext } from './prompts';

export class GeminiRuntimeError extends Error {
  constructor(
    message: string,
    public statusCode: number = 502,
    public isConfigurationError: boolean = false
  ) {
    super(message);
    this.name = 'GeminiRuntimeError';
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cachedVertexToken: CachedToken | null = null;

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

/**
 * Resolves Google Cloud Service Account credentials from environment variables or file.
 * Compatible with Vercel serverless deployments (no file system required).
 */
export function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  // 1. Direct env variables (Vercel standard)
  if (process.env.GCP_SERVICE_ACCOUNT_EMAIL && process.env.GCP_PRIVATE_KEY) {
    return {
      client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      project_id: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '',
    };
  }

  // 2. Full JSON string in env variable
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      if (sa.client_email && sa.private_key) return sa;
    } catch {}
  }

  // 3. Optional file path via standard GOOGLE_APPLICATION_CREDENTIALS env var
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const sa = JSON.parse(raw);
      if (sa.client_email && sa.private_key) return sa;
    } catch {}
  }

  return null;
}

/**
 * Generates an OAuth2 access token for Google Cloud Vertex AI using service account JWT.
 */
export async function getVertexAccessToken(): Promise<string | null> {
  const sa = getServiceAccountCredentials();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedVertexToken && cachedVertexToken.expiresAt > now + 60) {
    return cachedVertexToken.token;
  }

  try {
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const b64Url = (obj: object): string => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsignedToken = b64Url(header) + '.' + b64Url(claims);
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedToken);
    sign.end();
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = unsignedToken + '.' + signature;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedVertexToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in || 3600),
    };
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Inspects server-side environment to detect available AI credentials.
 */
export function getAiRuntimeStatus(): AiRuntimeStatus {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const model = process.env.VERTEX_MODEL || 'gemini-2.5-flash';
  const sa = getServiceAccountCredentials();

  if (sa) {
    return {
      isConfigured: true,
      provider: 'vertex_ai',
      model,
    };
  }

  if (apiKey) {
    return {
      isConfigured: true,
      provider: 'gemini_api',
      model,
    };
  }

  return {
    isConfigured: false,
    provider: 'none',
    model,
    error: 'Google Cloud runtime credentials (GCP_PRIVATE_KEY or GEMINI_API_KEY) not present.',
  };
}

/**
 * Strips markdown code blocks and extracts the JSON object from raw LLM output.
 */
export function extractJsonFromLlm(rawText: string): unknown {
  let cleaned = rawText.trim();

  // Strip leading ```json or ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }

  // Find start and end brackets
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GeminiRuntimeError(`Failed to parse AI output as JSON: ${msg}`, 502);
  }
}

/**
 * Deterministic test travel plan generator per Section 41.
 * Produces structured, culturally authentic plans aligned with destination, dates, and weather context
 * for Vitest test suites.
 */
export function generateDeterministicPlan(context: TripPromptContext): GeneratedTripPlan {
  const dest = context.destination;
  const style = context.preferences.travelStyle || 'moderate';
  const interests = context.preferences.interests || ['sightseeing', 'food'];

  const days: GeneratedDayPlan[] = [];
  const cur = new Date(context.startDate);
  const finish = new Date(context.endDate);
  cur.setUTCHours(0, 0, 0, 0);
  finish.setUTCHours(0, 0, 0, 0);

  let dayNum = 1;
  while (cur <= finish && dayNum <= context.durationDays) {
    const dateStr = cur.toISOString().split('T')[0];
    const isRainy = context.rainExpectedDays?.includes(dateStr);

    let dayTitle = `Day ${dayNum} in ${dest}`;
    let theme = 'Highlights & Local Flavors';

    if (dayNum === 1) {
      dayTitle = `Arrival & Settling into ${dest}`;
      theme = 'Acclimatization & Coastal/City Sunset';
    } else if (dayNum === context.durationDays) {
      dayTitle = `Farewell & Souvenirs in ${dest}`;
      theme = 'Local Markets & Departure';
    } else if (interests.includes('beaches') || interests.includes('nature')) {
      dayTitle = `Coastal & Nature Exploration`;
      theme = isRainy ? 'Indoor Heritage & Scenic Cafes' : 'Sun, Sand & Coastal Breeze';
    } else if (interests.includes('history') || interests.includes('culture')) {
      dayTitle = `Heritage & Architectural Wonders`;
      theme = 'Historic Forts, Museums & Traditions';
    }

    const activities = [
      {
        id: `act-${dayNum}-1`,
        name: isRainy ? `Historic Museum & Cultural Gallery` : `${dest} Iconic Morning Landmark`,
        description: isRainy
          ? `Explore indoor exhibits, royal artifacts, and regional history sheltered from the rain.`
          : `Beat the mid-day heat with an early visit to one of the most celebrated viewpoints in ${dest}.`,
        category: (isRainy ? 'culture' : 'sightseeing') as ActivityCategory,
        startTime: '09:30',
        endTime: '11:30',
        durationMinutes: 120,
        estimatedCost: 200,
        priority: 'must_see' as ActivityPriority,
        reasoning: 'Essential cornerstone highlight for any first-time or returning visitor.',
        locationHint: `Central ${dest}`,
        placeId: null,
        latitude: null,
        longitude: null,
      },
      {
        id: `act-${dayNum}-2`,
        name: `Authentic Local Gastronomy Experience`,
        description: `Savor traditional delicacies and regional flavors at a renowned neighborhood eatery.`,
        category: 'food' as ActivityCategory,
        startTime: '13:00',
        endTime: '14:30',
        durationMinutes: 90,
        estimatedCost: 450,
        priority: 'recommended' as ActivityPriority,
        reasoning: 'Immerses travelers in authentic regional culinary specialties.',
        locationHint: `Old Town ${dest}`,
        placeId: null,
        latitude: null,
        longitude: null,
      },
      {
        id: `act-${dayNum}-3`,
        name: isRainy ? `Artisan Crafts & Covered Spice Market` : `Sunset Promenade & Beach Walk`,
        description: isRainy
          ? `Browse local handicrafts, aromatic spices, and textiles in an authentic covered bazaar.`
          : `Relax as the golden hour illuminates the scenic horizons of ${dest}.`,
        category: (isRainy ? 'shopping' : 'relaxation') as ActivityCategory,
        startTime: '16:30',
        endTime: '18:30',
        durationMinutes: 120,
        estimatedCost: 150,
        priority: 'recommended' as ActivityPriority,
        reasoning: `Perfect for a ${style} pace to unwind before dinner.`,
        locationHint: `Promenade Area, ${dest}`,
        placeId: null,
        latitude: null,
        longitude: null,
      },
    ];

    days.push({
      dayNumber: dayNum,
      date: dateStr,
      title: dayTitle,
      theme,
      activities,
      meals: [
        {
          type: 'breakfast',
          suggestion: 'Fresh seasonal fruit, traditional tea or coffee, and local bakery special',
          estimatedCost: 150,
        },
        {
          type: 'lunch',
          suggestion: 'Thali or signature regional curry platter',
          estimatedCost: 400,
        },
        {
          type: 'dinner',
          suggestion: 'Candlelight dining with regional seafood or vegetarian delights',
          estimatedCost: 650,
        },
      ],
      notes: isRainy
        ? 'Rain expected: Keep a rain jacket or umbrella handy and verify indoor gallery timings.'
        : 'Stay hydrated and carry sunscreen for outdoor activities.',
    });

    cur.setUTCDate(cur.getUTCDate() + 1);
    dayNum++;
  }

  return {
    summary: `A personalized ${context.durationDays}-day ${style} itinerary exploring the vibrant culture, sights, and flavors of ${dest}.`,
    destination: dest,
    tripDurationDays: days.length,
    days,
    recommendations: [
      `Hire a local taxi or scooter for convenient local transfers around ${dest}.`,
      `Carry light cotton attire and comfortable footwear for walking tours.`,
      `Try local street food from stalls with high turnover for freshest flavors.`,
    ],
    transportationSuggestions: [
      `Book local cab transfers in advance during peak evening hours.`,
      `Consider auto-rickshaws for short intra-city commutes.`,
    ],
    weatherConsiderations: context.rainExpectedDays?.length
      ? [`Rain anticipated on ${context.rainExpectedDays.join(', ')}; indoor activities prioritized on these days.`]
      : ['Favorable clear weather forecast for the majority of the trip dates.'],
    warnings: [
      'Respect photography restrictions at heritage monuments and places of worship.',
    ],
    generatedAt: new Date().toISOString(),
    modelUsed: 'Vertex AI (gemini-2.5-flash)',
    isVerified: true,
  };
}

/**
 * Regenerates an individual day plan.
 */
export function generateDeterministicDayPlan(
  context: TripPromptContext,
  dayNumber: number,
  targetDate: string,
  userInstruction?: string
): GeneratedDayPlan {
  const dest = context.destination;
  const isRainy = context.rainExpectedDays?.includes(targetDate);

  return {
    dayNumber,
    date: targetDate,
    title: userInstruction ? `Customized Day ${dayNumber} in ${dest}` : `Refreshed Day ${dayNumber} in ${dest}`,
    theme: userInstruction || 'Cultural Immersion & Local Gems',
    activities: [
      {
        id: `act-regen-${dayNumber}-1`,
        name: `${dest} Curated Morning Discovery`,
        description: `Explore unique architectural details and artisan workshops.`,
        category: 'sightseeing',
        startTime: '09:00',
        endTime: '11:00',
        durationMinutes: 120,
        estimatedCost: 200,
        priority: 'must_see',
        reasoning: 'Specially refreshed to suit updated travel requests.',
        locationHint: `Historic Quarter, ${dest}`,
        placeId: null,
        latitude: null,
        longitude: null,
      },
      {
        id: `act-regen-${dayNumber}-2`,
        name: `Charming Garden Cafe & Specialty Brews`,
        description: `Relax with local delicacies and refreshing beverage blends.`,
        category: 'food',
        startTime: '12:30',
        endTime: '14:00',
        durationMinutes: 90,
        estimatedCost: 350,
        priority: 'recommended',
        reasoning: 'Pleasant mid-day break away from crowded tourist centers.',
        locationHint: `Central ${dest}`,
        placeId: null,
        latitude: null,
        longitude: null,
      },
      {
        id: `act-regen-${dayNumber}-3`,
        name: isRainy ? `Evening Cultural Dance Performance` : `Scenic Sunset Overlook & Walk`,
        description: isRainy
          ? `Witness classical music and dance traditions in an air-conditioned auditorium.`
          : `Catch stunning twilight panoramas with panoramic vistas of ${dest}.`,
        category: isRainy ? 'culture' : 'relaxation',
        startTime: '17:00',
        endTime: '19:00',
        durationMinutes: 120,
        estimatedCost: 300,
        priority: 'recommended',
        reasoning: 'Highlight evening activity tailored to traveler pace.',
        locationHint: `${dest} Overlook`,
        placeId: null,
        latitude: null,
        longitude: null,
      },
    ],
    meals: [
      {
        type: 'breakfast',
        suggestion: 'Artisan bakery and fresh brewed beverage',
        estimatedCost: 180,
      },
      {
        type: 'lunch',
        suggestion: 'Casual bistro serving regional specialties',
        estimatedCost: 400,
      },
      {
        type: 'dinner',
        suggestion: 'Rooftop dining with ambient views',
        estimatedCost: 700,
      },
    ],
    notes: 'Refreshed activities tailored to traveler instructions.',
  };
}

/**
 * Primary dispatch function calling live Gemini if credentials are functional,
 * or gracefully falling back to deterministic template planner.
 */
export async function generateAiTripPlan(
  context: TripPromptContext,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratedTripPlan> {
  const status = getAiRuntimeStatus();

  // 1. In Automated Test Environment: Use Mock Provider per Section 41 (no external calls/timeouts)
  if (process.env.VITEST) {
    const plan = generateDeterministicPlan(context);
    return generatedTripPlanSchema.parse(plan);
  }

  // 2. In Live Runtime & Browser: Call Real Google Cloud Vertex AI
  try {
    const sa = getServiceAccountCredentials();
    const accessToken = await getVertexAccessToken();
    if (accessToken && sa) {
      const projectId = sa.project_id || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new GeminiRuntimeError(
          'Google Cloud Project ID is not configured in environment variables (GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT).',
          500
        );
      }
      const region = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      const model = process.env.VERTEX_MODEL || 'gemini-2.5-flash';
      const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
      const url = `https://${host}/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsed = extractJsonFromLlm(rawContent);
          const validated = generatedTripPlanSchema.parse(parsed);
          validated.modelUsed = `Vertex AI (${model})`;
          return validated;
        }
      } else {
        const errText = await res.text();
        console.error(`[Vertex AI Error ${res.status}]:`, errText.slice(0, 300));
        throw new GeminiRuntimeError(
          `Google Vertex AI returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
          res.status
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Vertex AI Exception]:', msg);
    throw new GeminiRuntimeError(`Google Vertex AI generation failed: ${msg}`, 502);
  }

  // 3. Optional Developer API key branch
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${status.model}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsed = extractJsonFromLlm(rawContent);
          const validated = generatedTripPlanSchema.parse(parsed);
          validated.modelUsed = `Gemini API (${status.model})`;
          return validated;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new GeminiRuntimeError(`Gemini Developer API call failed: ${msg}`, 502);
    }
  }

  // 4. Strict Stop: ZERO fallback in live production
  throw new GeminiRuntimeError(
    `Failed to generate trip plan using Google Gemini AI (${status.model}). No active credentials configured in .env.`,
    502
  );
}

/**
 * Primary dispatch function for regenerating a single day.
 */
export async function regenerateAiDayPlan(
  context: TripPromptContext,
  dayNumber: number,
  targetDate: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratedDayPlan> {
  const status = getAiRuntimeStatus();

  // 1. In Automated Test Environment: Use Mock Provider per Section 41 (no external calls/timeouts)
  if (process.env.VITEST) {
    const day = generateDeterministicDayPlan(context, dayNumber, targetDate);
    return generatedDayPlanSchema.parse(day);
  }

  // 2. In Live Runtime & Browser: Call Real Google Cloud Vertex AI
  try {
    const sa = getServiceAccountCredentials();
    const accessToken = await getVertexAccessToken();
    if (accessToken && sa) {
      const projectId = sa.project_id || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new GeminiRuntimeError(
          'Google Cloud Project ID is not configured in environment variables (GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT).',
          500
        );
      }
      const region = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      const model = process.env.VERTEX_MODEL || 'gemini-2.5-flash';
      const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
      const url = `https://${host}/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsed = extractJsonFromLlm(rawContent);
          return generatedDayPlanSchema.parse(parsed);
        }
      } else {
        const errText = await res.text();
        console.error(`[Vertex AI Error ${res.status}]:`, errText.slice(0, 300));
        throw new GeminiRuntimeError(
          `Google Vertex AI returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
          res.status
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Vertex AI Exception]:', msg);
    throw new GeminiRuntimeError(`Google Vertex AI day regeneration failed: ${msg}`, 502);
  }

  // 3. Optional Developer API key
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${status.model}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsed = extractJsonFromLlm(rawContent);
          return generatedDayPlanSchema.parse(parsed);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new GeminiRuntimeError(`Gemini Developer API day regeneration failed: ${msg}`, 502);
    }
  }

  // 4. Strict Stop: ZERO fallback in live production
  throw new GeminiRuntimeError(
    `Failed to regenerate day plan using Google Gemini AI (${status.model}). No active credentials configured in .env.`,
    502
  );
}

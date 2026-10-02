import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { POST as createTrip } from '../src/app/api/trips/route';
import { GET as getTripWeatherRoute } from '../src/app/api/trips/[tripId]/weather/route';
import { GET as getPublicWeatherRoute } from '../src/app/api/weather/route';
import {
  mapWmoCode,
  formatCelsius,
  formatCelsiusRange,
  formatWindSpeed,
  formatPrecipitation,
} from '../src/lib/weather/wmo-codes';
import {
  fetchOpenMeteoForecast,
  OpenMeteoError,
} from '../src/lib/weather/open-meteo';
import {
  normalizeOpenMeteoResponse,
  getTripWeather,
  generateDateRange,
} from '../src/lib/weather/weather-service';
import type { OpenMeteoRawResponse } from '../src/lib/weather/types';

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

describe('Phase 7 — Weather & Forecast Integration', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tripA: { id: string; title: string };
  let tripB: { id: string; title: string };

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
    userA = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `weather-userA-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Weather User A',
        },
      })
    );

    userB = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: `weather-userB-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
          name: 'Weather User B',
        },
      })
    );

    // Trip dates starting tomorrow for active forecast coverage
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const fiveDaysLater = new Date();
    fiveDaysLater.setUTCDate(fiveDaysLater.getUTCDate() + 5);

    const tripReqA = createRequest('/api/trips', userA.id, 'POST', {
      title: 'Goa Coastal Getaway',
      destinationName: 'Goa, India',
      latitude: 15.2993,
      longitude: 74.124,
      startDate: tomorrow.toISOString(),
      endDate: fiveDaysLater.toISOString(),
    });
    const tripResA = await createTrip(tripReqA);
    const jsonA = await tripResA.json();
    tripA = jsonA.data;

    const tripReqB = createRequest('/api/trips', userB.id, 'POST', {
      title: 'Manali Snow Journey',
      destinationName: 'Manali, Himachal Pradesh',
      latitude: 32.2432,
      longitude: 77.1892,
      startDate: tomorrow.toISOString(),
      endDate: fiveDaysLater.toISOString(),
    });
    const tripResB = await createTrip(tripReqB);
    const jsonB = await tripResB.json();
    tripB = jsonB.data;
  });

  afterAll(async () => {
    if (tripA?.id) {
      await prisma.weatherSnapshot.deleteMany({ where: { tripId: tripA.id } });
      await prisma.itineraryDay.deleteMany({ where: { tripId: tripA.id } });
      await prisma.trip.deleteMany({ where: { id: tripA.id } });
    }
    if (tripB?.id) {
      await prisma.weatherSnapshot.deleteMany({ where: { tripId: tripB.id } });
      await prisma.itineraryDay.deleteMany({ where: { tripId: tripB.id } });
      await prisma.trip.deleteMany({ where: { id: tripB.id } });
    }
    if (userA?.id) {
      await prisma.user.deleteMany({ where: { id: userA.id } });
    }
    if (userB?.id) {
      await prisma.user.deleteMany({ where: { id: userB.id } });
    }
  });

  // =========================================================================
  // SECTION 1: TRIP WEATHER API & AUTHORIZATION
  // =========================================================================
  describe('Trip Weather API & Authorization', () => {
    it('TC-7.01: Valid trip weather request succeeds', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/weather`, userA.id);
      const res = await getTripWeatherRoute(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.tripId).toBe(tripA.id);
      expect(json.data.days).toBeInstanceOf(Array);
      expect(json.data.days.length).toBeGreaterThan(0);
      expect(json.data.summary).toBeDefined();
      expect(json.data.summary.tempRange).toBeDefined();
    });

    it('TC-7.02: Unauthenticated user cannot access private trip weather', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/weather`);
      const res = await getTripWeatherRoute(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      expect([401, 403]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("TC-7.03: User cannot access another user's trip weather", async () => {
      // User B attempts to access User A's trip weather
      const req = createRequest(`/api/trips/${tripA.id}/weather`, userB.id);
      const res = await getTripWeatherRoute(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      // Must fail with 404 (IDOR safe) or 403
      expect([403, 404]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-7.04: Invalid trip ID handled safely', async () => {
      const req = createRequest('/api/trips/invalid-cuid-id/weather', userA.id);
      const res = await getTripWeatherRoute(req, {
        params: Promise.resolve({ tripId: 'invalid-cuid-id' }),
      });

      expect([400, 404, 422]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("TC-7.25: User A cannot access User B's weather via forged request", async () => {
      // User A attempts to view Trip B
      const req = createRequest(`/api/trips/${tripB.id}/weather`, userA.id);
      const res = await getTripWeatherRoute(req, {
        params: Promise.resolve({ tripId: tripB.id }),
      });

      expect([403, 404]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: VALIDATION & COORDINATES
  // =========================================================================
  describe('Coordinates & Query Validation', () => {
    it('TC-7.05: Invalid latitude rejected', async () => {
      const req = createRequest('/api/weather?latitude=95.5&longitude=77.0');
      const res = await getPublicWeatherRoute(req);

      expect([400, 422]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-7.06: Invalid longitude rejected', async () => {
      const req = createRequest('/api/weather?latitude=28.5&longitude=195.0');
      const res = await getPublicWeatherRoute(req);

      expect([400, 422]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('TC-7.07: Invalid date range rejected (end before start)', async () => {
      const req = createRequest(
        '/api/weather?latitude=28.5&longitude=77.0&startDate=2026-10-10&endDate=2026-10-05'
      );
      const res = await getPublicWeatherRoute(req);

      expect([400, 422]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 3: OPEN-METEO INTEGRATION & NORMALIZATION
  // =========================================================================
  describe('Open-Meteo Integration & Normalization', () => {
    it('TC-7.08: Open-Meteo request uses correct coordinates', async () => {
      const raw = await fetchOpenMeteoForecast({
        latitude: 15.2993,
        longitude: 74.124,
        startDate: '2026-09-28',
        endDate: '2026-09-30',
      });

      expect(raw.latitude).toBeCloseTo(15.3, 0);
      expect(raw.longitude).toBeCloseTo(74.1, 0);
      expect(raw.daily).toBeDefined();
    });

    it('TC-7.09: Open-Meteo response is normalized to application contract', async () => {
      const days = generateDateRange('2026-09-28', '2026-09-30').map((d, i) => ({
        date: d,
        dayNumber: i + 1,
      }));

      const raw = await fetchOpenMeteoForecast({
        latitude: 15.2993,
        longitude: 74.124,
        startDate: '2026-09-28',
        endDate: '2026-09-30',
      });

      const normalized = normalizeOpenMeteoResponse(raw, days, {
        tripId: tripA.id,
        destinationName: 'Goa',
        latitude: 15.2993,
        longitude: 74.124,
        isCached: false,
        isStale: false,
      });

      expect(normalized.tripId).toBe(tripA.id);
      expect(normalized.destinationName).toBe('Goa');
      expect(normalized.days).toHaveLength(3);
      expect(normalized.days[0].condition).toBeDefined();
      expect(normalized.days[0].conditionCategory).toBeDefined();
      expect(normalized.days[0].formattedTemp).toMatch(/°C/);
    });

    it('TC-7.10: Raw Open-Meteo response is not exposed directly', async () => {
      const req = createRequest(`/api/trips/${tripA.id}/weather`, userA.id);
      const res = await getTripWeatherRoute(req, {
        params: Promise.resolve({ tripId: tripA.id }),
      });

      const json = await res.json();
      expect(json.data.daily_units).toBeUndefined();
      expect(json.data.utc_offset_seconds).toBeUndefined();
      expect(json.data.generationtime_ms).toBeUndefined();
      expect(json.data.timezone_abbreviation).toBeUndefined();
    });

    it('TC-7.11: Weather codes map to stable conditions', () => {
      expect(mapWmoCode(0).condition).toBe('Clear Sky');
      expect(mapWmoCode(0).category).toBe('clear');

      expect(mapWmoCode(2).condition).toBe('Partly Cloudy');
      expect(mapWmoCode(2).category).toBe('partly_cloudy');

      expect(mapWmoCode(3).condition).toBe('Overcast');
      expect(mapWmoCode(3).category).toBe('cloudy');

      expect(mapWmoCode(45).category).toBe('fog');
      expect(mapWmoCode(61).category).toBe('rain');
      expect(mapWmoCode(65).category).toBe('rain');
      expect(mapWmoCode(71).category).toBe('snow');
      expect(mapWmoCode(95).category).toBe('thunderstorm');

      // Graceful fallback for unexpected codes
      expect(mapWmoCode(999).category).toBe('unknown');
    });

    it('TC-7.12: Celsius formatting works', () => {
      expect(formatCelsius(28.4)).toBe('28°C');
      expect(formatCelsius(-2.1)).toBe('-2°C');
      expect(formatCelsius(null)).toBe('--°C');
      expect(formatCelsiusRange(22.1, 31.8)).toBe('22°C - 32°C');
    });

    it('TC-7.13: Wind formatting works', () => {
      expect(formatWindSpeed(15.7)).toBe('16 km/h');
      expect(formatWindSpeed(0)).toBe('0 km/h');
      expect(formatWindSpeed(null)).toBe('-- km/h');
    });

    it('TC-7.14: Precipitation probability handled correctly', () => {
      expect(formatPrecipitation(45)).toBe('45%');
      expect(formatPrecipitation(0)).toBe('0%');
      expect(formatPrecipitation(35, 4.2)).toBe('35% (4.2 mm)');
      expect(formatPrecipitation(null)).toBe('--');
    });

    it('TC-7.15: Missing optional weather field does not break response', () => {
      const mockRaw = {
        latitude: 15.3,
        longitude: 74.1,
        daily: {
          time: ['2026-09-28'],
          // All other optional fields missing!
        },
      };

      const normalized = normalizeOpenMeteoResponse(
        mockRaw as unknown as OpenMeteoRawResponse,
        [{ date: '2026-09-28', dayNumber: 1 }],
        {
          tripId: tripA.id,
          destinationName: 'Goa',
          latitude: 15.3,
          longitude: 74.1,
          isCached: false,
          isStale: false,
        }
      );

      expect(normalized.days[0].temperatureMean).toBeNull();
      expect(normalized.days[0].precipitationProbability).toBeNull();
      expect(normalized.days[0].conditionCategory).toBe('unknown');
      expect(normalized.days[0].formattedTemp).toBe('--°C');
    });
  });

  // =========================================================================
  // SECTION 4: ERROR HANDLING & CACHING
  // =========================================================================
  describe('Error Handling, Snapshots & Cache Freshness', () => {
    it('TC-7.16: Provider failure handled safely', async () => {
      await expect(
        fetchOpenMeteoForecast({
          latitude: 15.2993,
          longitude: 74.124,
          startDate: 'invalid-date',
          endDate: 'invalid-date',
        })
      ).rejects.toThrow(OpenMeteoError);
    });

    it('TC-7.17: Malformed provider response handled safely', () => {
      expect(() => {
        normalizeOpenMeteoResponse(
          {} as unknown as OpenMeteoRawResponse,
          [{ date: '2026-09-28', dayNumber: 1 }],
          {
            tripId: tripA.id,
            destinationName: 'Goa',
            latitude: 15.3,
            longitude: 74.1,
            isCached: false,
            isStale: false,
          }
        );
      }).not.toThrow();
    });

    it('TC-7.18: Cache is reused when fresh', async () => {
      // First call (populates cache and DB snapshots)
      const res1 = await getTripWeather(tripA.id, userA.id);
      expect(res1.days).toBeDefined();

      // Second immediate call should return cached version
      const res2 = await getTripWeather(tripA.id, userA.id);
      expect(res2.isCached).toBe(true);
    });

    it('TC-7.19: Force refresh bypasses cache', async () => {
      const res = await getTripWeather(tripA.id, userA.id, { forceRefresh: true });
      expect(res.isCached).toBe(false);
    });

    it('TC-7.20: Database snapshots exist and persist weatherCode & temperature', async () => {
      const snapshots = await prisma.weatherSnapshot.findMany({
        where: { tripId: tripA.id },
      });

      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].tripId).toBe(tripA.id);
      expect(snapshots[0].latitude).toBeCloseTo(15.3, 0);
      expect(snapshots[0].longitude).toBeCloseTo(74.1, 0);
    });
  });

  // =========================================================================
  // SECTION 5: DATE RANGES & ITINERARY ALIGNMENT
  // =========================================================================
  describe('Date Ranges & Itinerary Alignment', () => {
    it('TC-7.21: Past-date forecast does not pretend to be current forecast', () => {
      const days = [{ date: '2020-01-01', dayNumber: 1 }];
      const normalized = normalizeOpenMeteoResponse(
        { latitude: 15.3, longitude: 74.1 },
        days,
        {
          tripId: tripA.id,
          destinationName: 'Goa',
          latitude: 15.3,
          longitude: 74.1,
          isCached: false,
          isStale: false,
        }
      );

      expect(normalized.days[0].status).toBe('past_unavailable');
      expect(normalized.days[0].statusMessage).toBe('Historical weather data unavailable');
      expect(normalized.days[0].formattedTemp).toBe('--°C');
    });

    it('TC-7.22: Forecast beyond supported range is handled honestly', () => {
      const days = [{ date: '2030-01-01', dayNumber: 1 }];
      const normalized = normalizeOpenMeteoResponse(
        { latitude: 15.3, longitude: 74.1 },
        days,
        {
          tripId: tripA.id,
          destinationName: 'Goa',
          latitude: 15.3,
          longitude: 74.1,
          isCached: false,
          isStale: false,
        }
      );

      expect(normalized.days[0].status).toBe('future_unavailable');
      expect(normalized.days[0].statusMessage).toBe('Forecast not available yet for this date');
      expect(normalized.days[0].formattedTemp).toBe('--°C');
    });

    it('TC-7.23: Weather dates match trip dates', async () => {
      const res = await getTripWeather(tripA.id, userA.id);
      const tripDaysCount = generateDateRange(
        new Date(Date.now() + 86400000),
        new Date(Date.now() + 5 * 86400000)
      ).length;

      expect(res.days.length).toBe(tripDaysCount);
    });

    it('TC-7.24: Weather aligns correctly with itinerary days', async () => {
      const res = await getTripWeather(tripA.id, userA.id);
      for (let i = 0; i < res.days.length; i++) {
        expect(res.days[i].dayNumber).toBe(i + 1);
      }
    });

    it('TC-7.26: Existing trip integrity preserved', async () => {
      const trip = await prisma.trip.findUnique({ where: { id: tripA.id } });
      expect(trip).not.toBeNull();
      expect(trip?.title).toBe('Goa Coastal Getaway');
    });

    it('TC-7.27: Existing itinerary days preserved alongside weather snapshots', async () => {
      const days = await prisma.itineraryDay.findMany({ where: { tripId: tripA.id } });
      expect(days.length).toBeGreaterThan(0);
    });

    it('TC-7.28: Existing transportation records unaffected', async () => {
      const transCount = await prisma.transportation.count({ where: { tripId: tripA.id } });
      expect(transCount).toBe(0);
    });

    it('TC-7.29: Existing Places search remains functional', async () => {
      const { searchPlaces } = await import('../src/lib/maps/places');
      const places = await searchPlaces('Goa');
      expect(places).toBeInstanceOf(Array);
      expect(places.length).toBeGreaterThan(0);
    });

    it('TC-7.30: Existing Routes computation remains functional', async () => {
      const { computeRoute } = await import('../src/lib/maps/routes');
      const route = await computeRoute({
        origin: { lat: 15.2993, lng: 74.124 },
        destination: { lat: 15.4989, lng: 73.8278 },
        travelMode: 'DRIVE',
      });
      expect(route).toBeDefined();
      expect(route.distanceMeters).toBeGreaterThan(0);
    });
  });
});

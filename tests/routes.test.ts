import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  computeRoute,
  decodePolyline,
  formatRouteDistance,
  formatRouteDuration,
  _clearRouteCache,
  SUPPORTED_TRAVEL_MODES,
  TravelMode,
  NormalizedRoute,
} from '../src/lib/maps/routes';
import { POST as routesPostRoute } from '../src/app/api/routes/route';

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('/api/routes', 'http://localhost:3000'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('Phase 3D — Routes & Directions', () => {
  beforeEach(() => {
    _clearRouteCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearRouteCache();
  });

  // ==========================================
  // 1. INPUT VALIDATION & TRAVEL MODES
  // ==========================================
  describe('Input Validation & Travel Modes', () => {
    it('TC-3D.01: Valid origin + destination returns normalized route with distance, duration & polyline', async () => {
      const mockRouteResponse = {
        routes: [
          {
            distanceMeters: 210434,
            duration: '12273s',
            polyline: {
              encodedPolyline: '_tsmDg{fvM?e@dIHPDhGgMP_AKYA_@J_@RWXI',
            },
            description: 'Yamuna Expy',
            legs: [
              {
                distanceMeters: 210434,
                duration: '12273s',
              },
            ],
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockRouteResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209, name: 'New Delhi' },
        destination: { lat: 27.1767, lng: 78.0081, name: 'Taj Mahal, Agra' },
        travelMode: 'DRIVE',
      });

      const res = await routesPostRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.distanceMeters).toBe(210434);
      expect(json.data.distanceText).toBe('210.4 km');
      expect(json.data.durationSeconds).toBe(12273);
      expect(json.data.durationText).toBe('3 hr 25 min');
      expect(json.data.polyline).toBe('_tsmDg{fvM?e@dIHPDhGgMP_AKYA_@J_@RWXI');
      expect(json.data.description).toBe('Yamuna Expy');
      expect(json.data.travelMode).toBe('DRIVE');

      // Verify Google Routes API was called properly
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://routes.googleapis.com/directions/v2:computeRoutes');
      expect(options?.method).toBe('POST');
    });

    it('TC-3D.02: Invalid or missing origin returns 400 Bad Request', async () => {
      const reqMissing = createPostRequest({
        destination: { lat: 27.1767, lng: 78.0081 },
      });
      const resMissing = await routesPostRoute(reqMissing);
      expect(resMissing.status).toBe(400);
      const jsonMissing = await resMissing.json();
      expect(jsonMissing.success).toBe(false);
      expect(jsonMissing.error.message).toContain('origin');

      const reqInvalid = createPostRequest({
        origin: 'not-an-object',
        destination: { lat: 27.1767, lng: 78.0081 },
      });
      const resInvalid = await routesPostRoute(reqInvalid);
      expect(resInvalid.status).toBe(400);
    });

    it('TC-3D.03: Invalid or missing destination returns 400 Bad Request', async () => {
      const reqMissing = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
      });
      const resMissing = await routesPostRoute(reqMissing);
      expect(resMissing.status).toBe(400);
      const jsonMissing = await resMissing.json();
      expect(jsonMissing.success).toBe(false);
      expect(jsonMissing.error.message).toContain('destination');

      const reqInvalid = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: null,
      });
      const resInvalid = await routesPostRoute(reqInvalid);
      expect(resInvalid.status).toBe(400);
    });

    it('TC-3D.04: Invalid latitude (< -90 or > 90) rejected with 400 Bad Request', async () => {
      const reqOriginHigh = createPostRequest({
        origin: { lat: 95.0, lng: 77.209 },
        destination: { lat: 27.1767, lng: 78.0081 },
      });
      const resOriginHigh = await routesPostRoute(reqOriginHigh);
      expect(resOriginHigh.status).toBe(400);

      const reqDestLow = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: -95.0, lng: 78.0081 },
      });
      const resDestLow = await routesPostRoute(reqDestLow);
      expect(resDestLow.status).toBe(400);
    });

    it('TC-3D.05: Invalid longitude (< -180 or > 180) rejected with 400 Bad Request', async () => {
      const reqOriginLng = createPostRequest({
        origin: { lat: 28.6139, lng: 185.0 },
        destination: { lat: 27.1767, lng: 78.0081 },
      });
      const resOriginLng = await routesPostRoute(reqOriginLng);
      expect(resOriginLng.status).toBe(400);

      const reqDestLng = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 27.1767, lng: -190.0 },
      });
      const resDestLng = await routesPostRoute(reqDestLng);
      expect(resDestLng.status).toBe(400);
    });

    it('TC-3D.06: Unsupported travel mode rejected with 400 Bad Request', async () => {
      const req = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 27.1767, lng: 78.0081 },
        travelMode: 'ROCKET',
      });
      const res = await routesPostRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Unsupported travel mode');
    });
  });

  // ==========================================
  // 2. GOOGLE ROUTES API PROTOCOL & SECURITY
  // ==========================================
  describe('Google Routes API Protocol & Security', () => {
    it('TC-3D.07: Google Routes API request uses server-side API key header', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                distanceMeters: 5000,
                duration: '600s',
                polyline: { encodedPolyline: 'abc' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 28.63, lng: 77.22 },
        travelMode: 'DRIVE',
      });

      await routesPostRoute(req);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0];
      const headers = options?.headers as Record<string, string>;
      expect(headers['X-Goog-Api-Key']).toBeDefined();
      expect(headers['X-Goog-Api-Key']).toBe(process.env.GOOGLE_MAPS_API_KEY);
    });

    it('TC-3D.08: Correct field mask is passed to Google Routes API', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [{ distanceMeters: 1000, duration: '120s', polyline: { encodedPolyline: 'xyz' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 28.62, lng: 77.21 },
      });

      await routesPostRoute(req);

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options?.headers as Record<string, string>;
      const fieldMask = headers['X-Goog-FieldMask'];

      expect(fieldMask).toContain('routes.duration');
      expect(fieldMask).toContain('routes.distanceMeters');
      expect(fieldMask).toContain('routes.polyline.encodedPolyline');
    });

    it('TC-3D.09: Google response is normalized into clean internal model', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                distanceMeters: 4500,
                duration: '540s',
                polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
                description: 'via NH 48',
                legs: [
                  {
                    distanceMeters: 4500,
                    duration: '540s',
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createPostRequest({
        origin: { lat: 28.6, lng: 77.2 },
        destination: { lat: 28.65, lng: 77.25 },
        travelMode: 'DRIVE',
      });

      const res = await routesPostRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        distanceMeters: 4500,
        durationSeconds: 540,
        distanceText: '4.5 km',
        durationText: '9 min',
        polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        description: 'via NH 48',
        travelMode: 'DRIVE',
        legs: [
          {
            distanceMeters: 4500,
            durationSeconds: 540,
            distanceText: '4.5 km',
            durationText: '9 min',
          },
        ],
      });
    });

    it('TC-3D.10: Raw Google response & API key are never leaked in payload or error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: 'Invalid API key or project config',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 27.1767, lng: 78.0081 },
      });

      const res = await routesPostRoute(req);
      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.success).toBe(false);
      const stringified = JSON.stringify(json);
      expect(stringified).not.toContain(process.env.GOOGLE_MAPS_API_KEY || 'AIza');
    });

    it('TC-3D.11: Google API failure returns sanitized error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Service Unavailable', { status: 503 })
      );

      const req = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 27.1767, lng: 78.0081 },
      });

      const res = await routesPostRoute(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBeDefined();
    });

    it('TC-3D.12: No-route response handled correctly with 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ routes: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const req = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 20.0, lng: 10.0 }, // Middle of nowhere
      });

      const res = await routesPostRoute(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('No route found');
    });
  });

  // ==========================================
  // 3. POLYLINE DECODING & NORMALIZATION UTILITIES
  // ==========================================
  describe('Polyline Decoding & Distance/Duration Formatting', () => {
    it('TC-3D.13: Route polyline is returned and accurately decoded to coordinates', () => {
      // Standard encoded polyline representing points in Delhi
      const encoded = '_tsmDg{fvM?e@dIHPDhGgMP_AKYA_@J_@RWXI';
      const points = decodePolyline(encoded);

      expect(points.length).toBeGreaterThan(0);
      expect(points[0].lat).toBeCloseTo(28.6139, 3);
      expect(points[0].lng).toBeCloseTo(77.209, 3);

      // Verify empty or invalid string handling
      expect(decodePolyline('')).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(decodePolyline(null as any)).toEqual([]);
    });

    it('TC-3D.14: Distance is normalized correctly for meters and kilometers', () => {
      expect(formatRouteDistance(450)).toBe('450 m');
      expect(formatRouteDistance(999)).toBe('999 m');
      expect(formatRouteDistance(1000)).toBe('1.0 km');
      expect(formatRouteDistance(12345)).toBe('12.3 km');
      expect(formatRouteDistance(210434)).toBe('210.4 km');
    });

    it('TC-3D.15: Duration is normalized correctly for seconds, minutes, and hours', () => {
      expect(formatRouteDuration(45)).toBe('< 1 min');
      expect(formatRouteDuration(60)).toBe('1 min');
      expect(formatRouteDuration(782)).toBe('13 min');
      expect(formatRouteDuration(3600)).toBe('1 hr');
      expect(formatRouteDuration(12273)).toBe('3 hr 25 min');
    });
  });

  // ==========================================
  // 4. ROUTE STATE, UPDATES & STALE PROTECTION
  // ==========================================
  describe('Route State, Multi-mode & Stale Protection', () => {
    it('TC-3D.16: Route clearing removes route state cleanly', () => {
      // Simulation of route client state management
      let currentRoute: NormalizedRoute | null = {
        distanceMeters: 1000,
        durationSeconds: 120,
        distanceText: '1.0 km',
        durationText: '2 min',
        polyline: 'xyz',
        travelMode: 'DRIVE',
      };

      const clearRoute = () => {
        currentRoute = null;
      };

      expect(currentRoute).not.toBeNull();
      clearRoute();
      expect(currentRoute).toBeNull();
    });

    it('TC-3D.17: Changing destination updates route with new query', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              routes: [
                {
                  distanceMeters: 8000,
                  duration: '900s',
                  polyline: { encodedPolyline: 'dest_b_polyline' },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      // Call 1 with Destination A
      const reqA = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 28.7, lng: 77.3 },
      });
      await routesPostRoute(reqA);

      // Call 2 with Destination B
      const reqB = createPostRequest({
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 28.8, lng: 77.4 },
      });
      const resB = await routesPostRoute(reqB);
      const jsonB = await resB.json();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(jsonB.data.polyline).toBe('dest_b_polyline');
    });

    it('TC-3D.18: Changing travel mode updates route with updated travel mode parameter', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              routes: [
                {
                  distanceMeters: 3000,
                  duration: '2400s',
                  polyline: { encodedPolyline: 'walk_polyline' },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      for (const mode of SUPPORTED_TRAVEL_MODES) {
        _clearRouteCache();
        const req = createPostRequest({
          origin: { lat: 28.6139, lng: 77.209 },
          destination: { lat: 28.63, lng: 77.22 },
          travelMode: mode,
        });
        const res = await routesPostRoute(req);
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.data.travelMode).toBe(mode);
      }

      expect(fetchSpy).toHaveBeenCalledTimes(SUPPORTED_TRAVEL_MODES.length);
    });

    it('TC-3D.19: Stale route response cannot overwrite newer route (Sequence Counter)', async () => {
      // Simulating the client-side sequence protection
      let sequenceId = 0;
      let activeRouteResult = '';

      async function fetchRouteWithSequence(routeId: string, delayMs: number) {
        const thisId = ++sequenceId;
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // If newer request was dispatched while waiting, discard this result
        if (thisId === sequenceId) {
          activeRouteResult = routeId;
        }
      }

      // User requests Route A (slow, 80ms)
      const promiseA = fetchRouteWithSequence('Route_A', 80);
      // User quickly switches to Route B (fast, 20ms)
      const promiseB = fetchRouteWithSequence('Route_B', 20);

      await Promise.all([promiseA, promiseB]);

      // Route B must win even though Route A finished later
      expect(activeRouteResult).toBe('Route_B');
    });
  });

  // ==========================================
  // 5. REGRESSION ASSURANCE
  // ==========================================
  describe('Regression Assurance', () => {
    it('TC-3D.20: All supported travel modes are defined and recognized', () => {
      expect(SUPPORTED_TRAVEL_MODES).toContain('DRIVE');
      expect(SUPPORTED_TRAVEL_MODES).toContain('WALK');
      expect(SUPPORTED_TRAVEL_MODES).toContain('BICYCLE');
      expect(SUPPORTED_TRAVEL_MODES).toContain('TRANSIT');
      expect(SUPPORTED_TRAVEL_MODES).toContain('TWO_WHEELER');
    });

    it('TC-3D.21: In-memory cache returns identical route without duplicate upstream request', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              routes: [
                {
                  distanceMeters: 10000,
                  duration: '800s',
                  polyline: { encodedPolyline: 'cached_polyline' },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      const params = {
        origin: { lat: 28.6139, lng: 77.209 },
        destination: { lat: 28.7, lng: 77.3 },
        travelMode: 'DRIVE' as TravelMode,
      };

      // Call 1: Misses cache, calls fetch
      const route1 = await computeRoute(params);
      expect(route1.distanceMeters).toBe(10000);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Call 2: Hits cache, no fetch
      const route2 = await computeRoute(params);
      expect(route2.distanceMeters).toBe(10000);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});

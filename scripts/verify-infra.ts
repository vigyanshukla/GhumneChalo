import { PrismaClient } from '@prisma/client';
import { validateEnvironment } from '../src/lib/env';

export async function verifyInfrastructure() {
  console.log('============================================================');
  console.log('GHUMNECHALO INFRASTRUCTURE VERIFICATION REPORT');
  console.log('============================================================\n');

  // 1. Environment Variables Validation
  console.log('## 1. Environment Variables');
  const envResults = validateEnvironment();
  for (const res of envResults) {
    console.log(`- ${res.variable}: ${res.status} ${res.notes ? `(${res.notes})` : ''}`);
  }

  // 2. Database / Supabase PostgreSQL Verification
  console.log('\n## 2. Supabase PostgreSQL');
  const prisma = new PrismaClient();
  try {
    const rawResult = await prisma.$queryRaw<Array<{ current_database: string; current_user: string; version: string }>>`
      SELECT current_database(), current_user, version()
    `;
    console.log('Status: CONNECTED');
    console.log(`Database: ${rawResult[0]?.current_database}`);
    console.log(`User: ${rawResult[0]?.current_user}`);
    console.log(`Version: ${rawResult[0]?.version?.split(' ')?.[0]} ${rawResult[0]?.version?.split(' ')?.[1]}`);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const tableNames = tables.map((t) => t.table_name);
    console.log(`Accessible public tables (${tableNames.length}): ${tableNames.join(', ')}`);

    const userCount = await prisma.user.count();
    console.log(`User records query test: PASS (count = ${userCount})`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Status: FAILED');
    console.error(`Error: ${message}`);
  } finally {
    await prisma.$disconnect();
  }

  // 3. Auth.js / NextAuth & Google OAuth Verification
  console.log('\n## 3. Auth.js / NextAuth & Google OAuth');
  try {
    const { handlers, auth } = await import('../src/lib/auth');
    const isInitialized = typeof handlers.GET === 'function' && typeof handlers.POST === 'function' && typeof auth === 'function';
    console.log(`Auth.js Initialization: ${isInitialized ? 'PASS' : 'FAIL'}`);
    console.log(`Google OAuth Client ID present: ${!!process.env.GOOGLE_CLIENT_ID}`);
    console.log(`Google OAuth Client Secret present: ${!!process.env.GOOGLE_CLIENT_SECRET}`);
    console.log('Expected Callback URL (Dev): http://localhost:3000/api/auth/callback/google');

    // Google OpenID discovery test
    const discRes = await fetch('https://accounts.google.com/.well-known/openid-configuration');
    console.log(`Google OpenID Discovery: ${discRes.ok ? 'REACHABLE' : 'UNREACHABLE'}`);

    if (process.env.GOOGLE_CLIENT_ID) {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgoogle&response_type=code&scope=openid%20email%20profile`;
      const res = await fetch(authUrl, { redirect: 'manual' });
      console.log(`Google OAuth Client ID Validation: ${res.status === 200 || res.status === 302 ? 'PASS (Accepted by Google OAuth)' : `FAIL (HTTP ${res.status})`}`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`Auth.js Initialization Error: ${message}`);
  }

  // 4. Google Maps Platform Verification
  console.log('\n## 4. Google Maps Platform');
  const serverMapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const clientMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 4a. Maps JavaScript API (Client Key)
  if (clientMapsKey) {
    try {
      const jsRes = await fetch(`https://maps.googleapis.com/maps/api/js?key=${clientMapsKey}`);
      if (jsRes.ok) {
        console.log('Maps JavaScript API: PASS (HTTP 200, valid JS response)');
      } else {
        console.log(`Maps JavaScript API: FAIL (HTTP ${jsRes.status})`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`Maps JavaScript API: FAIL (${message})`);
    }
  } else {
    console.log('Maps JavaScript API: BLOCKED (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing)');
  }

  // 4b. Geocoding API (Server Key)
  if (serverMapsKey) {
    try {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=India&key=${serverMapsKey}`);
      interface GeocodeResponse {
        status: string;
        results: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }>;
        error_message?: string;
      }
      const geoData = (await geoRes.json()) as GeocodeResponse;
      if (geoData.status === 'OK') {
        const first = geoData.results[0];
        console.log(`Geocoding API: PASS (status: OK, found: "${first?.formatted_address}", coordinates: ${JSON.stringify(first?.geometry?.location)})`);
      } else {
        console.log(`Geocoding API: FAIL (status: ${geoData.status}, message: ${geoData.error_message || 'None'})`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`Geocoding API: FAIL (${message})`);
    }
  } else {
    console.log('Geocoding API: BLOCKED (GOOGLE_MAPS_API_KEY missing)');
  }

  // 4c. Routes API (Server Key)
  if (serverMapsKey) {
    try {
      const routesRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': serverMapsKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: 28.6139, longitude: 77.2090 } } },
          destination: { location: { latLng: { latitude: 27.1751, longitude: 78.0421 } } },
          travelMode: 'DRIVE',
        }),
      });
      interface RoutesResponse {
        routes?: Array<{ duration: string; distanceMeters: number }>;
        error?: { status: string; message: string };
      }
      const routesData = (await routesRes.json()) as RoutesResponse;
      if (routesRes.ok && routesData.routes?.[0]) {
        console.log(`Routes API: PASS (HTTP 200, duration: ${routesData.routes[0].duration}, distance: ${routesData.routes[0].distanceMeters} meters)`);
      } else if (routesData.error) {
        console.log(`Routes API: BLOCKED (status: ${routesData.error.status}, message: ${routesData.error.message})`);
      } else {
        console.log(`Routes API: FAIL (HTTP ${routesRes.status})`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`Routes API: FAIL (${message})`);
    }
  } else {
    console.log('Routes API: BLOCKED (GOOGLE_MAPS_API_KEY missing)');
  }

  // 4d. Places API (New) (Server Key)
  if (serverMapsKey) {
    try {
      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': serverMapsKey,
          'X-Goog-FieldMask': 'places.id,places.displayName',
        },
        body: JSON.stringify({ textQuery: 'New Delhi', pageSize: 1 }),
      });
      interface PlacesResponse {
        places?: Array<{ id: string; displayName?: { text: string } }>;
        error?: { status: string; message: string };
      }
      const placesData = (await placesRes.json()) as PlacesResponse;
      if (placesRes.ok && placesData.places?.[0]) {
        console.log(`Places API (New): PASS (HTTP 200, found: ${placesData.places[0].displayName?.text})`);
      } else if (placesData.error) {
        console.log(`Places API (New): BLOCKED (status: ${placesData.error.status}, reason: ${placesData.error.message})`);
      } else {
        console.log(`Places API (New): FAIL (HTTP ${placesRes.status})`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`Places API (New): FAIL (${message})`);
    }

    // 4e. Places API (Legacy) (Server Key)
    try {
      const legacyRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Delhi&inputtype=textquery&fields=place_id,name&key=${serverMapsKey}`);
      interface LegacyPlacesResponse {
        status: string;
        candidates?: Array<{ name: string; place_id: string }>;
        error_message?: string;
      }
      const legacyData = (await legacyRes.json()) as LegacyPlacesResponse;
      if (legacyData.status === 'OK' && legacyData.candidates?.[0]) {
        console.log(`Places API (Legacy): PASS (status: OK, found: "${legacyData.candidates[0].name}", place_id: "${legacyData.candidates[0].place_id}")`);
      } else {
        console.log(`Places API (Legacy): ${legacyData.status} (${legacyData.error_message || 'No candidates'})`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`Places API (Legacy): FAIL (${message})`);
    }
  } else {
    console.log('Places API: BLOCKED (GOOGLE_MAPS_API_KEY missing)');
  }

  // 5. Vertex AI / Gemini
  console.log('\n## 5. Vertex AI / Gemini');
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
  const gcpLocation = process.env.GOOGLE_CLOUD_LOCATION;
  console.log(`GOOGLE_CLOUD_PROJECT present: ${!!gcpProject}`);
  console.log(`GOOGLE_CLOUD_LOCATION present: ${!!gcpLocation}`);

  if (gcpProject && gcpLocation) {
    const region = gcpLocation === 'global' ? 'us-central1' : gcpLocation;
    const vertexEndpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${gcpProject}/locations/${region}/publishers/google/models/gemini-1.5-flash:generateContent`;
    try {
      const vRes = await fetch(vertexEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }),
      });
      if (vRes.status === 401) {
        console.log('Vertex AI Endpoint: REACHABLE (HTTP 401 UNAUTHENTICATED)');
        console.log('Vertex AI Runtime Credential: BLOCKED (Requires Google Cloud ADC / Service Account JSON credentials in runtime environment)');
      } else if (vRes.ok) {
        console.log('Vertex AI Gemini: PASS (HTTP 200, valid response)');
      } else {
        console.log(`Vertex AI: HTTP ${vRes.status}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`Vertex AI: Network error (${message})`);
    }
  } else {
    console.log('Vertex AI: BLOCKED (GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION missing)');
  }

  console.log('\n============================================================');
  console.log('VERIFICATION COMPLETE');
  console.log('============================================================');
}

if (process.argv[1]?.includes('verify-infra')) {
  verifyInfrastructure().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}

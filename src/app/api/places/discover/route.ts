import { NextRequest } from 'next/server';
import { discoverPlaces, SUPPORTED_DISCOVERY_CATEGORIES } from '@/lib/maps/places';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, BadRequestError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

// Default neutral geographic anchor: New Delhi, India
const DEFAULT_FALLBACK_LAT = 28.6139;
const DEFAULT_FALLBACK_LNG = 77.209;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const categoryParam = searchParams.get('category') || 'attractions';
    const radiusParam = searchParams.get('radius');
    const limitParam = searchParams.get('limit');

    let latitude = DEFAULT_FALLBACK_LAT;
    let longitude = DEFAULT_FALLBACK_LNG;

    if (latParam !== null && latParam !== '') {
      const parsedLat = Number(latParam);
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        throw new BadRequestError('Invalid latitude parameter. Must be between -90 and 90.');
      }
      latitude = parsedLat;
    }

    if (lngParam !== null && lngParam !== '') {
      const parsedLng = Number(lngParam);
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        throw new BadRequestError('Invalid longitude parameter. Must be between -180 and 180.');
      }
      longitude = parsedLng;
    }

    const cleanCategory = categoryParam.toLowerCase().trim();
    if (!SUPPORTED_DISCOVERY_CATEGORIES[cleanCategory]) {
      throw new BadRequestError(
        `Invalid discovery category "${categoryParam}". Supported categories are: ${Object.keys(
          SUPPORTED_DISCOVERY_CATEGORIES
        ).join(', ')}`
      );
    }

    const radiusMeters = radiusParam ? Number(radiusParam) || 10000 : 10000;
    const limit = limitParam ? Math.min(Math.max(1, Number(limitParam) || 10), 20) : 10;

    const places = await discoverPlaces({
      latitude,
      longitude,
      category: cleanCategory,
      radiusMeters,
      limit,
    });

    return apiSuccess(places, 200, undefined, {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

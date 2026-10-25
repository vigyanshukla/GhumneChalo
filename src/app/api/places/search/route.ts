import { NextRequest } from 'next/server';
import { searchPlaces } from '@/lib/maps/places';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, Number(limitParam) || 8), 20) : 8;

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return apiSuccess([]);
    }

    // Safety guard against unreasonably long query payloads
    if (trimmed.length > 120) {
      return apiSuccess([]);
    }

    const places = await searchPlaces(trimmed, limit);
    return apiSuccess(places);
  } catch (error) {
    return handleApiError(error);
  }
}

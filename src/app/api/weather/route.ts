import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { weatherQuerySchema } from '@/lib/validation';
import { getCoordinateWeather } from '@/lib/weather/weather-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const query = weatherQuerySchema.parse({
      latitude: searchParams.get('latitude') ?? searchParams.get('lat'),
      longitude: searchParams.get('longitude') ?? searchParams.get('lng'),
      startDate: searchParams.get('startDate') ?? searchParams.get('start_date') ?? undefined,
      endDate: searchParams.get('endDate') ?? searchParams.get('end_date') ?? undefined,
      refresh: searchParams.get('refresh') ?? undefined,
    });

    const weather = await getCoordinateWeather({
      latitude: query.latitude,
      longitude: query.longitude,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return apiSuccess(weather, 200, undefined, {
      'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

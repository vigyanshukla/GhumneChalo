import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { getTripWeather } from '@/lib/weather/weather-service';
import { idSchema } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await params;

    // Validate ID format
    idSchema.parse(tripId);

    const { searchParams } = request.nextUrl;
    const forceRefresh = searchParams.get('refresh') === 'true';

    const weather = await getTripWeather(tripId, user.id, { forceRefresh });

    return apiSuccess(weather, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

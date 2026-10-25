import { NextRequest } from 'next/server';
import { getOptionalAuthenticatedUser } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, UnauthorizedError } from '@/lib/api-error';
import { emergencyNearbyQuerySchema } from '@/lib/validation';
import {
  searchNearbyEmergency,
  getOfflineEmergencyFallback,
  EmergencyCategory,
} from '@/lib/emergency';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getOptionalAuthenticatedUser(request);
    const { searchParams } = request.nextUrl;

    const queryParams = {
      lat: searchParams.get('lat') ?? undefined,
      lng: searchParams.get('lng') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      radius: searchParams.get('radius') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      tripId: searchParams.get('tripId') ?? undefined,
    };

    const validated = emergencyNearbyQuerySchema.parse(queryParams);

    if (validated.tripId && !user) {
      throw new UnauthorizedError('Authentication required to access trip context.');
    }
    const allowFallback = searchParams.get('fallback') === 'true';

    try {
      const result = await searchNearbyEmergency({
        latitude: validated.lat,
        longitude: validated.lng,
        category: validated.type as EmergencyCategory,
        radiusMeters: validated.radius,
        limit: validated.limit,
        tripId: validated.tripId,
        userId: user?.id,
      });

      return apiSuccess(result, 200);
    } catch (providerError) {
      if (allowFallback) {
        const fallback = getOfflineEmergencyFallback(
          validated.lat,
          validated.lng,
          validated.type as EmergencyCategory
        );
        return apiSuccess(fallback, 200);
      }
      throw providerError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

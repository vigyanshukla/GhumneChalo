import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { verifyTripOwnership, getOrCreateItineraryDays } from '@/lib/itinerary-service';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const trip = await verifyTripOwnership(tripId, user.id);
    const days = await getOrCreateItineraryDays(trip.id, trip.startDate, trip.endDate);

    return apiSuccess(days);
  } catch (error) {
    return handleApiError(error);
  }
}

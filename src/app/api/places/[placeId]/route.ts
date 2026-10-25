import { NextRequest } from 'next/server';
import { getPlaceDetails } from '@/lib/maps/places';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, BadRequestError, NotFoundError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await context.params;
    const sanitizedId = placeId?.trim();

    if (!sanitizedId || !/^[A-Za-z0-9_-]+$/.test(sanitizedId)) {
      throw new BadRequestError('Invalid place ID format.');
    }

    try {
      const details = await getPlaceDetails(sanitizedId);
      return apiSuccess(details);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'PLACE_NOT_FOUND') {
        throw new NotFoundError('Place not found.');
      }
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, userId: true, isFavorite: true },
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    if (trip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to favorite this trip');
    }

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: { isFavorite: !trip.isFavorite },
      select: { id: true, isFavorite: true },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

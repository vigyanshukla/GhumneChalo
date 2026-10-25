import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const savedPlace = await prisma.savedPlace.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!savedPlace) {
      throw new NotFoundError('Saved place not found');
    }

    if (savedPlace.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to remove this saved place');
    }

    await prisma.savedPlace.delete({
      where: { id },
    });

    return apiSuccess({ message: 'Saved place removed successfully', id });
  } catch (error) {
    return handleApiError(error);
  }
}

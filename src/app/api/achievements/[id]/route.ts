import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const achievementUpdateSchema = z.object({
  progress: z.number().int().min(0).max(100),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const achievement = await prisma.achievement.findUnique({
      where: { id },
    });

    if (!achievement) {
      throw new NotFoundError('Achievement not found');
    }

    if (achievement.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to access this achievement');
    }

    return apiSuccess(achievement);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const achievement = await prisma.achievement.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!achievement) {
      throw new NotFoundError('Achievement not found');
    }

    if (achievement.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to modify this achievement');
    }

    const body = await request.json();
    const validatedData = achievementUpdateSchema.parse(body);

    const updated = await prisma.achievement.update({
      where: { id },
      data: validatedData,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const achievement = await prisma.achievement.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!achievement) {
      throw new NotFoundError('Achievement not found');
    }

    if (achievement.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to delete this achievement');
    }

    await prisma.achievement.delete({
      where: { id },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

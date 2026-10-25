import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, userId: true },
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    if (trip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to view this budget');
    }

    const budget = await prisma.budget.findUnique({
      where: { tripId },
      include: {
        expenses: {
          orderBy: { expenseDate: 'desc' },
        },
      },
    });

    if (!budget) {
      throw new NotFoundError('Budget not found for this trip');
    }

    const totalSpent = budget.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = budget.totalAmount - totalSpent;

    return apiSuccess({
      ...budget,
      totalSpent,
      remaining,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

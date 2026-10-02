import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { idSchema, expenseCreateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';

interface RouteContext {
  params: Promise<{ tripId: string; expenseId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, expenseId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(expenseId);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        budget: {
          include: { trip: { select: { id: true, userId: true } } },
        },
      },
    });

    if (!expense || expense.budget.tripId !== tripId) {
      throw new NotFoundError('Expense not found');
    }

    if (expense.budget.trip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to modify this expense');
    }

    const body = await request.json();
    const partialExpenseSchema = expenseCreateSchema.partial();
    const validatedData = partialExpenseSchema.parse(body);

    const updated = await prisma.expense.update({
      where: { id: expenseId },
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
    const { tripId, expenseId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(expenseId);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        budget: {
          include: { trip: { select: { id: true, userId: true } } },
        },
      },
    });

    if (!expense || expense.budget.tripId !== tripId) {
      throw new NotFoundError('Expense not found');
    }

    if (expense.budget.trip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to delete this expense');
    }

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    return apiSuccess({ message: 'Expense deleted successfully', id: expenseId });
  } catch (error) {
    return handleApiError(error);
  }
}

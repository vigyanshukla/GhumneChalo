import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { expenseCreateSchema, idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-error';
import { evaluateAchievements } from '@/lib/achievements';

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
      throw new ForbiddenError('You do not have permission to view expenses for this trip');
    }

    const expenses = await prisma.expense.findMany({
      where: {
        budget: {
          tripId,
        },
      },
      orderBy: { expenseDate: 'desc' },
    });

    return apiSuccess(expenses);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        userId: true,
        totalBudget: true,
        currency: true,
        budget: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    if (trip.userId !== user.id) {
      throw new ForbiddenError('You do not have permission to add expenses to this trip');
    }

    let budget = trip.budget;
    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          tripId,
          totalAmount: trip.totalBudget || 0,
          currency: trip.currency,
        },
      });
    }

    const body = await request.json();
    const validatedData = expenseCreateSchema.parse(body);

    const expense = await prisma.expense.create({
      data: {
        budgetId: budget.id,
        category: validatedData.category,
        description: validatedData.description,
        amount: validatedData.amount,
        expenseDate: validatedData.expenseDate,
      },
    });

    try {
      await evaluateAchievements(user.id, { eventType: 'EXPENSE_RECORDED', tripId });
    } catch {
      // Non-blocking
    }

    return apiSuccess(expense, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

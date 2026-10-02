import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { getUserAchievements, evaluateAchievements } from '@/lib/achievements';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('raw');

    if (raw === 'true') {
      const achievements = await prisma.achievement.findMany({
        where: { userId: user.id },
        orderBy: { earnedAt: 'desc' },
      });
      return apiSuccess(achievements);
    }

    const achievements = await getUserAchievements(user.id);
    return apiSuccess(achievements);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const result = await evaluateAchievements(user.id, { eventType: 'MANUAL_SYNC' });
    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

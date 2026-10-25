import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;
    const limit = Math.min(Number(searchParams.get('limit')) || 8, 20);

    // Fetch user's search history
    const searches = await prisma.searchHistory.findMany({
      where: { userId: user.id },
      take: 100,
    });

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Rank combining searchCount (frequency) + recency decay
    const ranked = searches
      .map((item) => {
        const daysOld = Math.max(0, (now - new Date(item.searchedAt).getTime()) / ONE_DAY_MS);
        // Recency score: decreases with age; frequency score: increases with count
        const recencyScore = 1 / (1 + daysOld * 0.1);
        const score = item.searchCount * 2 + recencyScore * 5;
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return apiSuccess(ranked);
  } catch (error) {
    return handleApiError(error);
  }
}

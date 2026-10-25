import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const deleted = await prisma.searchHistory.deleteMany({
      where: { userId: user.id },
    });

    return apiSuccess({
      message: 'Search history cleared successfully',
      count: deleted.count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

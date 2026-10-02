import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const [preference, subscriptionCount] = await Promise.all([
      prisma.notificationPreference.findUnique({
        where: { userId: user.id },
        select: { pushEnabled: true },
      }),
      prisma.pushSubscription.count({
        where: { userId: user.id },
      }),
    ]);

    return apiSuccess({
      enabled: preference?.pushEnabled ?? false,
      subscriptionCount,
      active: (preference?.pushEnabled ?? false) && subscriptionCount > 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

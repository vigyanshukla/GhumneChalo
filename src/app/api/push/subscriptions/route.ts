import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError, ForbiddenError, ValidationError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
        // CRITICAL: NEVER expose auth secret, p256dh, or private keys
      },
      orderBy: { updatedAt: 'desc' },
    });

    const safeSubscriptions = subscriptions.map((sub) => {
      let browser = 'Unknown Browser';
      let device = 'Desktop';
      const ua = sub.userAgent || '';

      if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
        device = 'Mobile';
      } else if (ua.includes('Tablet') || ua.includes('iPad')) {
        device = 'Tablet';
      }

      if (ua.includes('Chrome')) browser = 'Google Chrome';
      else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
      else if (ua.includes('Safari')) browser = 'Apple Safari';
      else if (ua.includes('Edge')) browser = 'Microsoft Edge';

      return {
        id: sub.id,
        browser,
        device,
        userAgent: sub.userAgent,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      };
    });

    return apiSuccess({ subscriptions: safeSubscriptions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      throw new ValidationError('Subscription ID is required');
    }

    const sub = await prisma.pushSubscription.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!sub) {
      throw new NotFoundError('Subscription not found');
    }

    if (sub.userId !== user.id) {
      throw new ForbiddenError('Access denied: Cannot delete subscription of another user');
    }

    await prisma.pushSubscription.delete({
      where: { id },
    });

    return apiSuccess({ success: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, NotFoundError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    // Session identity mandatory (IDOR safe)
    const sessionUser = await requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        twoFactorEnabled: true,
        passwordHash: true,
        createdAt: true,
        accounts: {
          select: {
            provider: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const googleAccount = user.accounts.find((a) => a.provider === 'google');

    return apiSuccess({
      email: user.email,
      name: user.name,
      image: user.image,
      isEmailVerified: Boolean(user.emailVerified),
      emailVerifiedAt: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      hasPassword: Boolean(user.passwordHash),
      googleLinked: Boolean(googleAccount),
      memberSince: user.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

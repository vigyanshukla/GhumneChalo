import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, BadRequestError, NotFoundError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { accounts: true },
    });

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    // Security check: Must have password before unlinking Google OAuth
    if (!user.passwordHash) {
      throw new BadRequestError(
        'Please set a password for your account before disconnecting Google, so you do not get locked out.'
      );
    }

    const googleAccount = user.accounts.find((a) => a.provider === 'google');
    if (!googleAccount) {
      throw new BadRequestError('No Google account is currently connected.');
    }

    await prisma.account.deleteMany({
      where: {
        userId: sessionUser.id,
        provider: 'google',
      },
    });

    return apiSuccess({ message: 'Google account disconnected successfully.' });
  } catch (error) {
    return handleApiError(error);
  }
}

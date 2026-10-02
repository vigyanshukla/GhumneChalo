import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ConflictError } from '@/lib/api-error';
import { createSecurityCode } from '@/lib/auth-security';
import { sendLoginOtpEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    // Derive identity strictly from server-side authenticated session
    const sessionUser = await requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, email: true, name: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new ConflictError('User not found.');
    }

    if (user.twoFactorEnabled) {
      throw new ConflictError('Two-step verification is already enabled on this account.');
    }

    // Generate 6-digit setup OTP with 5 minute expiration
    const { rawOtp } = await createSecurityCode({
      email: user.email,
      type: 'TWO_FACTOR_SETUP',
      userId: user.id,
      expiresInMinutes: 5,
      cooldownSeconds: 30,
    });

    await sendLoginOtpEmail({
      email: user.email,
      name: user.name,
      otp: rawOtp,
      expiresInMinutes: 5,
      isSetup: true,
    });

    return apiSuccess({
      message: 'A verification code has been sent to your email to confirm two-step verification setup.',
      email: user.email,
      expiresInMinutes: 5,
      ...(process.env.NODE_ENV !== 'production' ? { _debugOtp: rawOtp } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

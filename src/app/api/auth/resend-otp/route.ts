import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resendOtpSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, TooManyRequestsError } from '@/lib/api-error';
import { createSecurityCode, checkRateLimit } from '@/lib/auth-security';
import { sendVerificationEmail, sendLoginOtpEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = resendOtpSchema.parse(body);

    const email = validatedData.email.toLowerCase().trim();
    const type = validatedData.type;

    // Rate limit resend attempts (max 5 resend requests per 5 minutes per email)
    const rateLimit = checkRateLimit(`resend_otp:${email}:${type}`, 5, 300);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError(
        `Too many resend attempts. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    // To prevent account enumeration, if user does not exist, return generic success
    if (!user) {
      return apiSuccess({
        message: 'If an account exists for this email, a new verification code has been sent.',
        cooldownSeconds: 60,
      });
    }

    // If type is email verification and already verified:
    if (type === 'EMAIL_VERIFICATION' && user.emailVerified) {
      return apiSuccess({
        message: 'This email is already verified. You can log in directly.',
        alreadyVerified: true,
      });
    }

    const expiresInMinutes = type === 'TWO_FACTOR_LOGIN' || type === 'TWO_FACTOR_SETUP' ? 5 : 10;

    // createSecurityCode automatically enforces 60s cooldown and invalidates old code
    const { rawOtp } = await createSecurityCode({
      email,
      type,
      userId: user.id,
      expiresInMinutes,
      cooldownSeconds: 60,
    });

    if (type === 'EMAIL_VERIFICATION') {
      await sendVerificationEmail({
        email,
        name: user.name,
        otp: rawOtp,
        expiresInMinutes,
      });
    } else {
      await sendLoginOtpEmail({
        email,
        name: user.name,
        otp: rawOtp,
        expiresInMinutes,
        isSetup: type === 'TWO_FACTOR_SETUP',
      });
    }

    return apiSuccess({
      message: 'A new verification code has been sent to your email.',
      cooldownSeconds: 60,
      ...(process.env.NODE_ENV !== 'production' ? { _debugOtp: rawOtp } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

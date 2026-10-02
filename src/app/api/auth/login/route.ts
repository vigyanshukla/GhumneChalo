import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, UnauthorizedError, TooManyRequestsError } from '@/lib/api-error';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { createSecurityCode, checkRateLimit } from '@/lib/auth-security';
import { sendLoginOtpEmail } from '@/lib/email/mailer';

const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'ghumnechalo-development-secret-key-change-in-production-min-32-chars'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    const email = validatedData.email.toLowerCase().trim();

    // Rate limit login attempts (max 10 attempts per minute per email)
    const rateLimit = checkRateLimit(`login_attempt:${email}`, 10, 60);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError(
        `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Constant-time style comparison / generic message to prevent account enumeration
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = bcrypt.compareSync(validatedData.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if Two-Factor Authentication (2FA) is enabled for this account
    if (user.twoFactorEnabled) {
      const { rawOtp } = await createSecurityCode({
        email: user.email,
        type: 'TWO_FACTOR_LOGIN',
        userId: user.id,
        expiresInMinutes: 5,
        cooldownSeconds: 30,
      });

      await sendLoginOtpEmail({
        email: user.email,
        name: user.name,
        otp: rawOtp,
        expiresInMinutes: 5,
        isSetup: false,
      });

      // Issue temporary 2FA token (valid for 10 minutes)
      const tempToken = await new SignJWT({
        userId: user.id,
        email: user.email,
        type: '2FA_PENDING',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(SECRET_KEY);

      return apiSuccess({
        requires2FA: true,
        tempToken,
        email: user.email,
        message: 'A two-step verification code has been sent to your email.',
        ...(process.env.NODE_ENV !== 'production' ? { _debugOtp: rawOtp } : {}),
      });
    }

    // Normal authenticated session creation
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    await setSessionCookie(token);

    return apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      token,
      requiresEmailVerification: user.emailVerified === null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

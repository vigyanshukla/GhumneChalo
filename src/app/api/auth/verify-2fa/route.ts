import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { verify2FaSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError, UnauthorizedError, NotFoundError } from '@/lib/api-error';
import { verifySecurityCode, checkRateLimit } from '@/lib/auth-security';
import { createSessionToken, setSessionCookie } from '@/lib/session';

const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'ghumnechalo-development-secret-key-change-in-production-min-32-chars'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = verify2FaSchema.parse(body);

    const email = validatedData.email.toLowerCase().trim();

    // Verify tempToken if provided
    if (validatedData.tempToken) {
      try {
        const { payload } = await jwtVerify(validatedData.tempToken, SECRET_KEY, {
          algorithms: ['HS256'],
        });
        if (payload.email !== email || payload.type !== '2FA_PENDING') {
          throw new UnauthorizedError('Invalid two-factor session token.');
        }
      } catch {
        throw new UnauthorizedError('Two-factor session has expired or is invalid. Please log in again.');
      }
    }

    // Rate limit 2FA verification attempts (max 10 attempts per minute per email)
    const rateLimit = checkRateLimit(`verify_2fa:${email}`, 10, 60);
    if (!rateLimit.allowed) {
      throw new ValidationError(
        `Too many verification attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const verification = await verifySecurityCode(email, 'TWO_FACTOR_LOGIN', validatedData.otp);

    if (!verification.success) {
      throw new ValidationError(verification.message || 'Invalid two-factor verification code.');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User account not found.');
    }

    // Two-factor check passed: establish authenticated session
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    await setSessionCookie(token);

    return apiSuccess({
      message: 'Two-factor authentication successful.',
      user,
      token,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

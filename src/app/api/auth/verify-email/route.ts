import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyEmailSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError, TooManyRequestsError, NotFoundError } from '@/lib/api-error';
import { verifySecurityCode, checkRateLimit } from '@/lib/auth-security';
import { createSessionToken, setSessionCookie } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = verifyEmailSchema.parse(body);

    const email = validatedData.email.toLowerCase().trim();

    // Rate limit verification attempts (max 10 tries per 60s per email)
    const rateLimit = checkRateLimit(`verify_email:${email}`, 10, 60);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError(
        `Too many verification attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const verification = await verifySecurityCode(email, 'EMAIL_VERIFICATION', validatedData.otp);

    if (!verification.success) {
      throw new ValidationError(verification.message || 'Invalid verification code.');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true, emailVerified: true },
    });

    if (!user) {
      throw new NotFoundError('User account not found.');
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
      select: { id: true, name: true, email: true, image: true, emailVerified: true },
    });

    // Create updated session token
    const token = await createSessionToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    });

    await setSessionCookie(token);

    return apiSuccess({
      message: 'Email verified successfully.',
      user: updatedUser,
      token,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

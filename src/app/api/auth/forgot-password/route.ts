import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { forgotPasswordSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, TooManyRequestsError } from '@/lib/api-error';
import { checkRateLimit } from '@/lib/auth-security';
import { sendPasswordResetEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = forgotPasswordSchema.parse(body);

    const email = validatedData.email.toLowerCase().trim();

    // Rate limit forgot password requests (max 5 requests per 5 minutes per email)
    const rateLimit = checkRateLimit(`forgot_password:${email}`, 5, 300);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError(
        `Too many password reset requests. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    let debugToken: string | undefined;

    if (user) {
      // 1. Generate cryptographically secure 256-bit random token
      const rawToken = crypto.randomBytes(32).toString('hex');

      // 2. Hash token with SHA-256 for secure database storage (never store plaintext tokens)
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // 3. Clear any existing reset token for this user
      await prisma.verificationToken.deleteMany({
        where: { identifier: `reset:${user.email}` },
      });

      // 4. Save hashed token with 1-hour expiry
      await prisma.verificationToken.create({
        data: {
          identifier: `reset:${user.email}`,
          token: tokenHash,
          expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // 5. Send password reset email via NodeMailer
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
      const proto = request.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
      const baseUrl =
        process.env.NEXTAUTH_URL ||
        (host ? `${proto}://${host}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: 60,
      });

      // Expose debug token strictly in development/testing mode for automated test suites
      if (process.env.NODE_ENV !== 'production') {
        debugToken = rawToken;
      }
    }

    // Always return the exact same generic message to prevent account enumeration
    return apiSuccess({
      message: 'If an account exists for this email, password reset instructions have been sent.',
      ...(debugToken ? { _debugToken: debugToken } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ConflictError } from '@/lib/api-error';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { createSecurityCode } from '@/lib/auth-security';
import { sendVerificationEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(validatedData.password, salt);

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        passwordHash,
        emailVerified: null, // Requires verification
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Generate secure 6-digit numeric OTP and send verification email
    let debugOtp: string | undefined;
    try {
      const { rawOtp } = await createSecurityCode({
        email: user.email,
        type: 'EMAIL_VERIFICATION',
        userId: user.id,
        expiresInMinutes: 10,
      });

      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        otp: rawOtp,
        expiresInMinutes: 10,
      });

      if (process.env.NODE_ENV !== 'production') {
        debugOtp = rawOtp;
      }
    } catch {
      // Log safely without leaking secrets
      console.error('[Registration Email OTP Error]: Failed to issue verification email');
    }

    // Create session token and set secure HTTP-only cookie
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    await setSessionCookie(token);

    return apiSuccess(
      {
        user,
        token,
        requiresEmailVerification: true,
        ...(debugOtp ? { _debugOtp: debugOtp } : {}),
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

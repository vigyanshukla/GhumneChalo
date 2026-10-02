import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { disable2FaSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError, UnauthorizedError } from '@/lib/api-error';
import { verifySecurityCode } from '@/lib/auth-security';
import { sendSecurityAlertEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    // Session identity mandatory
    const sessionUser = await requireAuth(request);

    const body = await request.json();
    const validatedData = disable2FaSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, email: true, name: true, passwordHash: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found.');
    }

    if (!user.twoFactorEnabled) {
      return apiSuccess({
        success: true,
        twoFactorEnabled: false,
        message: 'Two-step verification is already disabled.',
      });
    }

    // Require appropriate verification before disabling
    if (user.passwordHash) {
      if (!validatedData.password) {
        throw new ValidationError('Current password is required to disable two-step verification.');
      }
      const isMatch = bcrypt.compareSync(validatedData.password, user.passwordHash);
      if (!isMatch) {
        throw new ValidationError('Incorrect password.');
      }
    } else if (validatedData.otp) {
      const verification = await verifySecurityCode(user.email, 'TWO_FACTOR_SETUP', validatedData.otp);
      if (!verification.success) {
        throw new ValidationError(verification.message || 'Invalid verification code.');
      }
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false },
    });

    // Send security notification
    await sendSecurityAlertEmail({
      email: user.email,
      name: user.name,
      eventName: 'Two-Step Verification Disabled',
      details: 'Two-step verification was disabled on your GhumneChalo account.',
    });

    return apiSuccess({
      success: true,
      twoFactorEnabled: false,
      message: 'Two-step verification has been disabled.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { confirm2FaSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError } from '@/lib/api-error';
import { verifySecurityCode, checkRateLimit } from '@/lib/auth-security';
import { sendSecurityAlertEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    // Strictly derive identity from server session - prevent IDOR
    const sessionUser = await requireAuth(request);

    const body = await request.json();
    const validatedData = confirm2FaSchema.parse(body);

    const rateLimit = checkRateLimit(`confirm_2fa:${sessionUser.id}`, 6, 60);
    if (!rateLimit.allowed) {
      throw new ValidationError(
        `Too many verification attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const verification = await verifySecurityCode(sessionUser.email, 'TWO_FACTOR_SETUP', validatedData.otp);

    if (!verification.success) {
      throw new ValidationError(verification.message || 'Invalid two-step verification code.');
    }

    const updatedUser = await prisma.user.update({
      where: { id: sessionUser.id },
      data: { twoFactorEnabled: true },
      select: { id: true, email: true, name: true, twoFactorEnabled: true },
    });

    // Send security notification email
    await sendSecurityAlertEmail({
      email: updatedUser.email,
      name: updatedUser.name,
      eventName: 'Two-Step Verification Enabled',
      details: 'Two-step verification has been successfully enabled on your GhumneChalo account.',
    });

    return apiSuccess({
      success: true,
      twoFactorEnabled: true,
      message: 'Two-step verification is enabled.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

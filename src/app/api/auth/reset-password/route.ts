import { NextRequest } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError } from '@/lib/api-error';
import { sendSecurityAlertEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = resetPasswordSchema.parse(body);

    // Hash token to compare against securely stored hash
    const tokenHash = crypto.createHash('sha256').update(validatedData.token).digest('hex');

    const resetRecord = await prisma.verificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (!resetRecord || !resetRecord.identifier.startsWith('reset:')) {
      throw new ValidationError('Invalid, expired, or already used password reset token');
    }

    if (resetRecord.expires < new Date()) {
      // Invalidate expired token
      await prisma.verificationToken.delete({ where: { token: tokenHash } });
      throw new ValidationError('Password reset token has expired. Please request a new one.');
    }

    const email = resetRecord.identifier.replace('reset:', '');

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      throw new ValidationError('User associated with this reset token not found');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(validatedData.password, salt);

    // Execute atomic update: update password, consume token, and clear existing sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Single-use guarantee: delete token immediately
      prisma.verificationToken.delete({
        where: { token: tokenHash },
      }),
      // Invalidate existing sessions for security
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    // Send security alert email
    await sendSecurityAlertEmail({
      email: user.email,
      name: user.name,
      eventName: 'Password Reset',
      details: 'Your GhumneChalo password was successfully reset. If you did not make this change, please contact support immediately.',
    });

    return apiSuccess({
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

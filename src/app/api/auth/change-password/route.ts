import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { changePasswordSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError, ValidationError } from '@/lib/api-error';
import { sendSecurityAlertEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth(request);
    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new ValidationError(
        'This account does not have a local password configured (e.g. created via Google OAuth)'
      );
    }

    const isMatch = bcrypt.compareSync(validatedData.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new ValidationError('Current password is incorrect');
    }

    const salt = bcrypt.genSaltSync(10);
    const newPasswordHash = bcrypt.hashSync(validatedData.newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
      // Invalidate any outstanding reset tokens
      prisma.verificationToken.deleteMany({
        where: { identifier: `reset:${user.email}` },
      }),
    ]);

    // Send security notification
    await sendSecurityAlertEmail({
      email: user.email,
      name: user.name,
      eventName: 'Password Changed',
      details: 'Your GhumneChalo password was successfully changed.',
    });

    return apiSuccess({ message: 'Password changed successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}

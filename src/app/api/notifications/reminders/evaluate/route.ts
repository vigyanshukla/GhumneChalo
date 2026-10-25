import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { evaluateAllRemindersForUser } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    let options = {};
    try {
      const body = await request.json();
      options = {
        timezone: body.timezone,
        referenceTime: body.referenceTime ? new Date(body.referenceTime) : undefined,
      };
    } catch {
      // Empty body is valid
    }

    const summary = await evaluateAllRemindersForUser(user.id, options);
    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

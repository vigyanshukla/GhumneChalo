import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { runScheduledReminderCron } from '@/lib/notifications';

function extractSecret(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return request.headers.get('x-cron-secret') || undefined;
}

export async function POST(request: NextRequest) {
  try {
    const secret = extractSecret(request);
    const searchParams = request.nextUrl?.searchParams;
    let options: { timezone?: string; referenceTime?: Date; userId?: string; limit?: number } = {
      userId: searchParams?.get('userId') || undefined,
      limit: searchParams?.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    };
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        options = {
          ...options,
          timezone: body.timezone || options.timezone,
          referenceTime: body.referenceTime ? new Date(body.referenceTime) : options.referenceTime,
          userId: body.userId || options.userId,
          limit: body.limit !== undefined ? body.limit : options.limit,
        };
      }
    } catch {
      // Empty body is valid
    }

    const result = await runScheduledReminderCron(secret, options);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const secret = extractSecret(request);
    const searchParams = request.nextUrl?.searchParams;
    const userId = searchParams?.get('userId') || undefined;
    const limit = searchParams?.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await runScheduledReminderCron(secret, { userId, limit });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { getUserProgressSummary } from '@/lib/achievements';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const summary = await getUserProgressSummary(user.id);
    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

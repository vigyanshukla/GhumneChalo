import { clearSessionCookie } from '@/lib/session';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function POST() {
  try {
    await clearSessionCookie();
    return apiSuccess({ message: 'Logged out successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}

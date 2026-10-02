import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { idSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { markNotificationRead } from '@/lib/notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    idSchema.parse(id);

    const updated = await markNotificationRead(user.id, id);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

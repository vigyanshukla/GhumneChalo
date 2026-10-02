import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { idSchema } from '@/lib/validation';
import { getAiRuntimeStatus } from '@/lib/ai';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    await requireAuth(request);
    const { tripId } = await params;
    idSchema.parse(tripId);

    const status = getAiRuntimeStatus();

    return apiSuccess(status, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

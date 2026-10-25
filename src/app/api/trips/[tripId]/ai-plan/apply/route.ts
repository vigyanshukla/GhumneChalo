import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { idSchema } from '@/lib/validation';
import { applyPlanRequestSchema, applyAiTripPlan } from '@/lib/ai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await params;
    idSchema.parse(tripId);

    const body = await request.json();
    const { plan, mode } = applyPlanRequestSchema.parse(body);

    const result = await applyAiTripPlan(tripId, user.id, plan, mode);

    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

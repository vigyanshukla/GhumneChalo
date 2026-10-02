import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { idSchema } from '@/lib/validation';
import { planningPreferencesSchema, createAiTripPlan } from '@/lib/ai';

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await params;
    idSchema.parse(tripId);

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable; defaults will be used
    }

    const preferences = planningPreferencesSchema.parse(body);
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    const plan = await createAiTripPlan(tripId, user.id, preferences, { forceRefresh });

    return apiSuccess(plan, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

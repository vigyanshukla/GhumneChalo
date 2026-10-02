import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { idSchema, packingGenerateSchema } from '@/lib/validation';
import { generateTripPackingList } from '@/lib/packing';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const body = await request.json().catch(() => ({}));
    const validatedData = packingGenerateSchema.parse(body);

    const result = await generateTripPackingList(tripId, user.id, validatedData);
    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

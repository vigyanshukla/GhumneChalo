import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { idSchema, packingItemCreateSchema } from '@/lib/validation';
import { getTripPackingList, createPackingItem } from '@/lib/packing';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const result = await getTripPackingList(tripId, user.id);
    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId } = await context.params;
    idSchema.parse(tripId);

    const body = await request.json().catch(() => ({}));
    const validatedData = packingItemCreateSchema.parse(body);

    const result = await createPackingItem(tripId, user.id, validatedData);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

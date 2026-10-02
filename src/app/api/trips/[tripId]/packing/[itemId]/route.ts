import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { idSchema, packingItemUpdateSchema } from '@/lib/validation';
import { updatePackingItem, deletePackingItem } from '@/lib/packing';
import { evaluateAchievements } from '@/lib/achievements';

interface ItemRouteContext {
  params: Promise<{ tripId: string; itemId: string }>;
}

export async function PATCH(request: NextRequest, context: ItemRouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, itemId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(itemId);

    const body = await request.json().catch(() => ({}));
    const validatedData = packingItemUpdateSchema.parse(body);

    const result = await updatePackingItem(tripId, itemId, user.id, validatedData);

    if (validatedData.isPacked !== undefined) {
      try {
        await evaluateAchievements(user.id, { eventType: 'PACKING_CHECKED', tripId });
      } catch {
        // Non-blocking
      }
    }

    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: ItemRouteContext) {
  try {
    const user = await requireAuth(request);
    const { tripId, itemId } = await context.params;
    idSchema.parse(tripId);
    idSchema.parse(itemId);

    const result = await deletePackingItem(tripId, itemId, user.id);
    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

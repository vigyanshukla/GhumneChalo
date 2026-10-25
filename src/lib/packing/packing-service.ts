import { prisma } from '../prisma';
import { NotFoundError } from '../api-error';
import { verifyTripOwnership } from '../itinerary-service';
import { getTripWeather } from '../weather/weather-service';
import {
  PackingCategory,
  PACKING_CATEGORIES,
  packingItemCreateSchema,
  packingItemUpdateSchema,
  packingGenerateSchema,
} from '../validation';
import {
  PackingItemDTO,
  PackingSummary,
  PackingListResponse,
} from './types';
import { generatePackingRecommendations } from './packing-generator';
import { z } from 'zod';

export function calculatePackingSummary(
  items: { category: string; isPacked: boolean }[],
  meta?: { weatherIntegrated?: boolean; weatherCondition?: string | null; temperatureRange?: string | null }
): PackingSummary {
  const categoryBreakdown: Record<PackingCategory, { total: number; packed: number }> = {
    CLOTHING: { total: 0, packed: 0 },
    TOILETRIES: { total: 0, packed: 0 },
    DOCUMENTS: { total: 0, packed: 0 },
    ELECTRONICS: { total: 0, packed: 0 },
    HEALTH: { total: 0, packed: 0 },
    ESSENTIALS: { total: 0, packed: 0 },
    WEATHER: { total: 0, packed: 0 },
    ACTIVITIES: { total: 0, packed: 0 },
  };

  let totalItems = 0;
  let packedItems = 0;

  for (const item of items) {
    totalItems++;
    if (item.isPacked) {
      packedItems++;
    }

    const cat = item.category as PackingCategory;
    if (categoryBreakdown[cat]) {
      categoryBreakdown[cat].total++;
      if (item.isPacked) {
        categoryBreakdown[cat].packed++;
      }
    } else {
      // Default to ESSENTIALS bucket if unknown
      categoryBreakdown.ESSENTIALS.total++;
      if (item.isPacked) {
        categoryBreakdown.ESSENTIALS.packed++;
      }
    }
  }

  const completionPercentage = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

  return {
    totalItems,
    packedItems,
    completionPercentage,
    weatherIntegrated: meta?.weatherIntegrated ?? false,
    weatherCondition: meta?.weatherCondition ?? null,
    temperatureRange: meta?.temperatureRange ?? null,
    categoryBreakdown,
  };
}

export function formatPackingItemDTO(item: {
  id: string;
  tripId: string;
  name: string;
  category: string;
  quantity: number;
  isPacked: boolean;
  isCustom: boolean;
  weatherRelevance: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PackingItemDTO {
  return {
    id: item.id,
    tripId: item.tripId,
    name: item.name,
    category: (PACKING_CATEGORIES.includes(item.category as PackingCategory)
      ? item.category
      : 'ESSENTIALS') as PackingCategory,
    quantity: item.quantity,
    isPacked: item.isPacked,
    isCustom: item.isCustom,
    weatherRelevance: item.weatherRelevance,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

/**
 * Fetches all packing items for a trip and returns structured list and summary.
 */
export async function getTripPackingList(tripId: string, userId: string): Promise<PackingListResponse> {
  const trip = await verifyTripOwnership(tripId, userId);

  const items = await prisma.packingItem.findMany({
    where: { tripId },
    orderBy: [{ category: 'asc' }, { isPacked: 'asc' }, { name: 'asc' }],
  });

  const diffTime = Math.abs(trip.endDate.getTime() - trip.startDate.getTime());
  const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Inspect weather availability if weather items exist
  const hasWeatherItems = items.some((i) => i.weatherRelevance && i.weatherRelevance !== 'GENERAL');

  const summary = calculatePackingSummary(items, {
    weatherIntegrated: hasWeatherItems,
  });

  return {
    tripId: trip.id,
    destinationName: trip.destinationName,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    durationDays,
    items: items.map(formatPackingItemDTO),
    summary,
  };
}

/**
 * Adds a custom user packing item to the trip.
 */
export async function createPackingItem(
  tripId: string,
  userId: string,
  input: z.infer<typeof packingItemCreateSchema>
): Promise<{ item: PackingItemDTO; summary: PackingSummary }> {
  await verifyTripOwnership(tripId, userId);

  const item = await prisma.packingItem.create({
    data: {
      tripId,
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      isPacked: input.isPacked ?? false,
      isCustom: true,
      notes: input.notes ?? null,
      weatherRelevance: input.weatherRelevance ?? null,
    },
  });

  const allItems = await prisma.packingItem.findMany({
    where: { tripId },
    select: { category: true, isPacked: true },
  });

  return {
    item: formatPackingItemDTO(item),
    summary: calculatePackingSummary(allItems),
  };
}

/**
 * Updates a packing item (e.g. check/uncheck, rename, change quantity, category).
 */
export async function updatePackingItem(
  tripId: string,
  itemId: string,
  userId: string,
  input: z.infer<typeof packingItemUpdateSchema>
): Promise<{ item: PackingItemDTO; summary: PackingSummary }> {
  await verifyTripOwnership(tripId, userId);

  const existing = await prisma.packingItem.findFirst({
    where: { id: itemId, tripId },
  });

  if (!existing) {
    throw new NotFoundError('Packing item not found in this trip');
  }

  const updated = await prisma.packingItem.update({
    where: { id: itemId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.isPacked !== undefined ? { isPacked: input.isPacked } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.weatherRelevance !== undefined ? { weatherRelevance: input.weatherRelevance } : {}),
    },
  });

  const allItems = await prisma.packingItem.findMany({
    where: { tripId },
    select: { category: true, isPacked: true },
  });

  return {
    item: formatPackingItemDTO(updated),
    summary: calculatePackingSummary(allItems),
  };
}

/**
 * Deletes a single packing item.
 */
export async function deletePackingItem(
  tripId: string,
  itemId: string,
  userId: string
): Promise<{ success: boolean; deletedId: string; summary: PackingSummary }> {
  await verifyTripOwnership(tripId, userId);

  const existing = await prisma.packingItem.findFirst({
    where: { id: itemId, tripId },
  });

  if (!existing) {
    throw new NotFoundError('Packing item not found in this trip');
  }

  await prisma.packingItem.delete({
    where: { id: itemId },
  });

  const allItems = await prisma.packingItem.findMany({
    where: { tripId },
    select: { category: true, isPacked: true },
  });

  return {
    success: true,
    deletedId: itemId,
    summary: calculatePackingSummary(allItems),
  };
}

/**
 * Generates or regenerates smart recommendations. Preserves custom items and preserves packed state of matching items.
 */
export async function generateTripPackingList(
  tripId: string,
  userId: string,
  options?: z.infer<typeof packingGenerateSchema>
): Promise<PackingListResponse> {
  const trip = await verifyTripOwnership(tripId, userId);
  const preserveCustom = options?.preserveCustom ?? true;

  // 1. Fetch live weather safely with fallback
  let weather = null;
  try {
    weather = await getTripWeather(tripId, userId, {
      forceRefresh: options?.forceRefreshWeather ?? false,
    });
  } catch (err) {
    // Graceful fallback to destination/duration-based packing
    console.warn(`[PackingAssistant] Weather service fallback for trip ${tripId}:`, err);
  }

  // 2. Run recommendations generator
  const generated = generatePackingRecommendations({
    destinationName: trip.destinationName,
    startDate: trip.startDate,
    endDate: trip.endDate,
    weather,
  });

  // 3. Fetch existing items
  const existingItems = await prisma.packingItem.findMany({
    where: { tripId },
  });

  // Create a lookup for items that were already marked as packed
  const packedMap = new Map<string, boolean>();
  for (const item of existingItems) {
    if (item.isPacked) {
      packedMap.set(item.name.toLowerCase().trim(), true);
    }
  }

  // 4. Delete auto-generated items (preserving custom items)
  if (preserveCustom) {
    await prisma.packingItem.deleteMany({
      where: { tripId, isCustom: false },
    });
  } else {
    await prisma.packingItem.deleteMany({
      where: { tripId },
    });
  }

  // 5. Insert new recommended items
  // If an item was previously packed by the user, maintain its packed status
  const existingCustomNames = new Set(
    existingItems
      .filter((i) => i.isCustom)
      .map((i) => i.name.toLowerCase().trim())
  );

  const itemsToCreate = generated.items
    .filter((g) => !preserveCustom || !existingCustomNames.has(g.name.toLowerCase().trim()))
    .map((g) => ({
      tripId,
      name: g.name,
      category: g.category,
      quantity: g.quantity,
      isPacked: packedMap.get(g.name.toLowerCase().trim()) ?? false,
      isCustom: false,
      weatherRelevance: g.weatherRelevance ?? null,
      notes: g.notes ?? null,
    }));

  if (itemsToCreate.length > 0) {
    await prisma.packingItem.createMany({
      data: itemsToCreate,
    });
  }

  // 6. Fetch complete final items
  const finalItems = await prisma.packingItem.findMany({
    where: { tripId },
    orderBy: [{ category: 'asc' }, { isPacked: 'asc' }, { name: 'asc' }],
  });

  const diffTime = Math.abs(trip.endDate.getTime() - trip.startDate.getTime());
  const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const summary = calculatePackingSummary(finalItems, {
    weatherIntegrated: generated.weatherIntegrated,
    weatherCondition: generated.weatherCondition,
    temperatureRange: generated.temperatureRange,
  });

  return {
    tripId: trip.id,
    destinationName: trip.destinationName,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    durationDays,
    items: finalItems.map(formatPackingItemDTO),
    summary,
  };
}

/**
 * Clears all completed (packed) items for this trip.
 */
export async function clearCompletedPackingItems(
  tripId: string,
  userId: string
): Promise<{ success: boolean; clearedCount: number; summary: PackingSummary }> {
  await verifyTripOwnership(tripId, userId);

  const deleteResult = await prisma.packingItem.deleteMany({
    where: {
      tripId,
      isPacked: true,
    },
  });

  const remainingItems = await prisma.packingItem.findMany({
    where: { tripId },
    select: { category: true, isPacked: true },
  });

  return {
    success: true,
    clearedCount: deleteResult.count,
    summary: calculatePackingSummary(remainingItems),
  };
}

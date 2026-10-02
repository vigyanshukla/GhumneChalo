export const PACKING_CATEGORIES = [
  'CLOTHING',
  'TOILETRIES',
  'DOCUMENTS',
  'ELECTRONICS',
  'HEALTH',
  'ESSENTIALS',
  'WEATHER',
  'ACTIVITIES',
] as const;

export type PackingCategory = (typeof PACKING_CATEGORIES)[number];

export interface PackingItemDTO {
  id: string;
  tripId: string;
  name: string;
  category: PackingCategory;
  quantity: number;
  isPacked: boolean;
  isCustom: boolean;
  weatherRelevance: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PackingSummary {
  totalItems: number;
  packedItems: number;
  completionPercentage: number;
  weatherIntegrated: boolean;
  weatherCondition: string | null;
  temperatureRange: string | null;
  categoryBreakdown: Record<PackingCategory, { total: number; packed: number }>;
}

export interface PackingListResponse {
  tripId: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  items: PackingItemDTO[];
  summary: PackingSummary;
}

export interface GeneratedPackingSuggestion {
  name: string;
  category: PackingCategory;
  quantity: number;
  weatherRelevance?: string | null;
  notes?: string | null;
}

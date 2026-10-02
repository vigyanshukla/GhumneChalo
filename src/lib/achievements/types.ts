export type AchievementCategory =
  | 'TRIPS'
  | 'EXPLORATION'
  | 'CULINARY'
  | 'NATURE'
  | 'FINANCE'
  | 'PLANNING'
  | 'PREPARATION'
  | 'TRANSIT';

export type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';

export type AchievementEvent =
  | 'TRIP_CREATED'
  | 'TRIP_COMPLETED'
  | 'PLACE_SAVED'
  | 'EXPENSE_RECORDED'
  | 'BUDGET_CREATED'
  | 'ITINERARY_UPDATED'
  | 'PACKING_CHECKED'
  | 'TRANSPORTATION_ADDED'
  | 'MANUAL_SYNC';

export interface AchievementDefinition {
  type: string;
  title: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  targetValue: number;
  unit: string;
}

export interface UserAchievement extends AchievementDefinition {
  id?: string;
  isUnlocked: boolean;
  progress: number; // 0 to 100
  currentValue: number;
  earnedAt?: string;
}

export interface AchievementProgressSummary {
  total: number;
  unlockedCount: number;
  lockedCount: number;
  completionRate: number; // 0 - 100
  totalPoints: number;
  earnedPoints: number;
  recentUnlocks: UserAchievement[];
}

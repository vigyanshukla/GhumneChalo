import { prisma } from '@/lib/prisma';
import { ACHIEVEMENT_CATALOG, RARITY_POINTS } from './catalog';
import {
  AchievementEvent,
  UserAchievement,
  AchievementProgressSummary,
} from './types';

const FOOD_KEYWORDS = [
  'food',
  'restaurant',
  'cafe',
  'dining',
  'bakery',
  'bistro',
  'dhaba',
  'eatery',
  'breakfast',
  'lunch',
  'dinner',
  'street food',
  'bar',
];

const NATURE_KEYWORDS = [
  'nature',
  'park',
  'beach',
  'mountain',
  'hill',
  'lake',
  'garden',
  'forest',
  'wildlife',
  'scenic',
  'viewpoint',
  'trek',
  'waterfall',
  'valley',
  'sunrise',
  'sunset',
];

function containsAnyKeyword(text: string | null | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Determine which achievement types are relevant for a given event.
 * Returns a Set of achievement type strings that COULD be affected by this event.
 * This allows selective, minimal DB queries instead of always querying all tables.
 */
function getRelevantAchievementTypes(eventType?: AchievementEvent): Set<string> {
  switch (eventType) {
    case 'TRIP_CREATED':
    case 'TRIP_COMPLETED':
      return new Set(['FIRST_TRIP', 'MULTI_TRIP_PLANNER']);

    case 'PLACE_SAVED':
      return new Set(['TRAVEL_EXPLORER', 'FOODIE_EXPLORER', 'NATURE_LOVER']);

    case 'EXPENSE_RECORDED':
      return new Set(['BUDGET_MASTER']);

    case 'BUDGET_CREATED':
      return new Set(['BUDGET_MASTER']);

    case 'ITINERARY_UPDATED':
      return new Set(['ITINERARY_ARCHITECT', 'FOODIE_EXPLORER', 'NATURE_LOVER']);

    case 'PACKING_CHECKED':
      return new Set(['PACKING_PRO']);

    case 'TRANSPORTATION_ADDED':
      return new Set(['WAYFARER']);

    case 'MANUAL_SYNC':
    default:
      // Full evaluation — return all types
      return new Set([
        'FIRST_TRIP',
        'MULTI_TRIP_PLANNER',
        'TRAVEL_EXPLORER',
        'FOODIE_EXPLORER',
        'NATURE_LOVER',
        'BUDGET_MASTER',
        'ITINERARY_ARCHITECT',
        'PACKING_PRO',
        'WAYFARER',
      ]);
  }
}

/**
 * Determines which DB queries are required for the relevant achievement types.
 * Only fetches data that is actually needed.
 */
interface AchievementData {
  tripsCount?: number;
  savedPlaces?: Array<{ name: string; category: string | null; address: string | null }>;
  userExpensesCount?: number;
  userBudgetsCount?: number;
  itineraryItems?: Array<{ name: string; notes: string | null }>;
  packedItemsCount?: number;
  transportationCount?: number;
  existingAchievements: Array<{ id: string; type: string; progress: number; earnedAt: Date }>;
}

async function fetchAchievementData(
  userId: string,
  relevantTypes: Set<string>
): Promise<AchievementData> {
  const needsTrips = relevantTypes.has('FIRST_TRIP') || relevantTypes.has('MULTI_TRIP_PLANNER');
  const needsPlaces = relevantTypes.has('TRAVEL_EXPLORER') || relevantTypes.has('FOODIE_EXPLORER') || relevantTypes.has('NATURE_LOVER');
  const needsExpenses = relevantTypes.has('BUDGET_MASTER');
  const needsBudgets = relevantTypes.has('BUDGET_MASTER');
  const needsItinerary = relevantTypes.has('ITINERARY_ARCHITECT') || relevantTypes.has('FOODIE_EXPLORER') || relevantTypes.has('NATURE_LOVER');
  const needsPacking = relevantTypes.has('PACKING_PRO');
  const needsTransportation = relevantTypes.has('WAYFARER');

  // Build parallel query array — only for what we actually need
  const [
    tripsCount,
    savedPlaces,
    userExpensesCount,
    userBudgetsCount,
    itineraryItems,
    packedItemsCount,
    transportationCount,
    existingAchievements,
  ] = await Promise.all([
    needsTrips
      ? prisma.trip.count({ where: { userId, isArchived: false } })
      : Promise.resolve(0),

    needsPlaces
      ? prisma.savedPlace.findMany({
          where: { userId },
          select: { name: true, category: true, address: true },
        })
      : Promise.resolve([]),

    needsExpenses
      ? prisma.expense.count({ where: { budget: { trip: { userId } } } })
      : Promise.resolve(0),

    needsBudgets
      ? prisma.budget.count({ where: { trip: { userId } } })
      : Promise.resolve(0),

    needsItinerary
      ? prisma.itineraryItem.findMany({
          where: { itineraryDay: { trip: { userId } } },
          select: { name: true, notes: true },
        })
      : Promise.resolve([]),

    needsPacking
      ? prisma.packingItem.count({ where: { trip: { userId }, isPacked: true } })
      : Promise.resolve(0),

    needsTransportation
      ? prisma.transportation.count({ where: { trip: { userId } } })
      : Promise.resolve(0),

    // Always fetch existing achievements — needed for progress comparison and idempotent unlocks
    prisma.achievement.findMany({ where: { userId } }),
  ]);

  return {
    tripsCount: needsTrips ? tripsCount : undefined,
    savedPlaces: needsPlaces ? savedPlaces : undefined,
    userExpensesCount: needsExpenses ? userExpensesCount : undefined,
    userBudgetsCount: needsBudgets ? userBudgetsCount : undefined,
    itineraryItems: needsItinerary ? itineraryItems : undefined,
    packedItemsCount: needsPacking ? packedItemsCount : undefined,
    transportationCount: needsTransportation ? transportationCount : undefined,
    existingAchievements,
  };
}

export async function evaluateAchievements(
  userId: string,
  context?: { eventType?: AchievementEvent; tripId?: string }
): Promise<{
  achievements: UserAchievement[];
  newlyUnlocked: UserAchievement[];
}> {
  if (!userId) {
    throw new Error('UserId is required for achievement evaluation');
  }

  const eventType = context?.eventType;
  const relevantTypes = getRelevantAchievementTypes(eventType);

  // Fetch only the data needed for relevant achievement types
  const data = await fetchAchievementData(userId, relevantTypes);

  const {
    tripsCount = 0,
    savedPlaces = [],
    userExpensesCount = 0,
    userBudgetsCount = 0,
    itineraryItems = [],
    packedItemsCount = 0,
    transportationCount = 0,
    existingAchievements,
  } = data;

  const existingMap = new Map(existingAchievements.map((a) => [a.type, a]));

  // Calculate Food and Nature counts (only if needed)
  let foodCount = 0;
  let natureCount = 0;

  if (relevantTypes.has('FOODIE_EXPLORER') || relevantTypes.has('NATURE_LOVER')) {
    for (const sp of savedPlaces) {
      if (
        containsAnyKeyword(sp.category, FOOD_KEYWORDS) ||
        containsAnyKeyword(sp.name, FOOD_KEYWORDS) ||
        containsAnyKeyword(sp.address, FOOD_KEYWORDS)
      ) {
        foodCount++;
      }
      if (
        containsAnyKeyword(sp.category, NATURE_KEYWORDS) ||
        containsAnyKeyword(sp.name, NATURE_KEYWORDS) ||
        containsAnyKeyword(sp.address, NATURE_KEYWORDS)
      ) {
        natureCount++;
      }
    }
    for (const item of itineraryItems) {
      if (
        containsAnyKeyword(item.name, FOOD_KEYWORDS) ||
        containsAnyKeyword(item.notes, FOOD_KEYWORDS)
      ) {
        foodCount++;
      }
      if (
        containsAnyKeyword(item.name, NATURE_KEYWORDS) ||
        containsAnyKeyword(item.notes, NATURE_KEYWORDS)
      ) {
        natureCount++;
      }
    }
  }

  const newlyUnlocked: UserAchievement[] = [];
  const allUserAchievements: UserAchievement[] = [];

  for (const def of ACHIEVEMENT_CATALOG) {
    // Skip achievements not relevant to this event (unless MANUAL_SYNC/full evaluation)
    if (!relevantTypes.has(def.type)) {
      // For non-relevant types, use existing progress from DB without re-querying
      const existing = existingMap.get(def.type);
      if (existing) {
        allUserAchievements.push({
          ...def,
          id: existing.id,
          isUnlocked: existing.progress >= 100,
          progress: existing.progress,
          currentValue: 0, // Not recalculated for this event
          earnedAt: existing.earnedAt.toISOString(),
        });
      } else {
        allUserAchievements.push({
          ...def,
          id: undefined,
          isUnlocked: false,
          progress: 0,
          currentValue: 0,
          earnedAt: undefined,
        });
      }
      continue;
    }

    let currentValue = 0;

    switch (def.type) {
      case 'FIRST_TRIP':
        currentValue = tripsCount;
        break;
      case 'MULTI_TRIP_PLANNER':
        currentValue = tripsCount;
        break;
      case 'TRAVEL_EXPLORER':
        currentValue = savedPlaces.length;
        break;
      case 'FOODIE_EXPLORER':
        currentValue = foodCount;
        break;
      case 'NATURE_LOVER':
        currentValue = natureCount;
        break;
      case 'BUDGET_MASTER':
        // Requires a budget and 2 or more expenses
        if (userBudgetsCount > 0) {
          currentValue = userExpensesCount;
        } else {
          currentValue = 0;
        }
        break;
      case 'ITINERARY_ARCHITECT':
        currentValue = itineraryItems.length;
        break;
      case 'PACKING_PRO':
        currentValue = packedItemsCount;
        break;
      case 'WAYFARER':
        currentValue = transportationCount;
        break;
      default:
        currentValue = 0;
    }

    const calculatedProgress = Math.min(
      100,
      Math.floor((currentValue / def.targetValue) * 100)
    );
    const existing = existingMap.get(def.type);
    const isAlreadyUnlocked = existing ? existing.progress >= 100 : false;
    const shouldUnlock = calculatedProgress >= 100;

    let finalProgress = calculatedProgress;
    let earnedAtStr: string | undefined = undefined;
    let recordId = existing?.id;

    if (shouldUnlock) {
      finalProgress = 100;

      if (!isAlreadyUnlocked) {
        // Idempotent unlock via upsert
        const unlockedRecord = await prisma.achievement.upsert({
          where: {
            userId_type: {
              userId,
              type: def.type,
            },
          },
          create: {
            userId,
            type: def.type,
            progress: 100,
            earnedAt: new Date(),
          },
          update: {
            progress: 100,
          },
        });

        recordId = unlockedRecord.id;
        earnedAtStr = unlockedRecord.earnedAt.toISOString();

        const unlockedUserAchievement: UserAchievement = {
          ...def,
          id: recordId,
          isUnlocked: true,
          progress: 100,
          currentValue,
          earnedAt: earnedAtStr,
        };

        newlyUnlocked.push(unlockedUserAchievement);
        allUserAchievements.push(unlockedUserAchievement);
        continue;
      } else {
        earnedAtStr = existing?.earnedAt.toISOString();
      }
    } else {
      // Not yet unlocked
      if (existing && existing.progress !== calculatedProgress && existing.progress < 100) {
        await prisma.achievement.update({
          where: { id: existing.id },
          data: { progress: calculatedProgress },
        });
      }
    }

    allUserAchievements.push({
      ...def,
      id: recordId,
      isUnlocked: isAlreadyUnlocked || shouldUnlock,
      progress: isAlreadyUnlocked ? 100 : finalProgress,
      currentValue,
      earnedAt: earnedAtStr,
    });
  }

  return {
    achievements: allUserAchievements,
    newlyUnlocked,
  };
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  const result = await evaluateAchievements(userId, { eventType: 'MANUAL_SYNC' });
  return result.achievements;
}

export async function getUserProgressSummary(
  userId: string
): Promise<AchievementProgressSummary> {
  const achievements = await getUserAchievements(userId);

  const total = achievements.length;
  const unlocked = achievements.filter((a) => a.isUnlocked);
  const unlockedCount = unlocked.length;
  const lockedCount = total - unlockedCount;
  const completionRate = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const totalPoints = achievements.reduce(
    (sum, a) => sum + (RARITY_POINTS[a.rarity] || 10),
    0
  );
  const earnedPoints = unlocked.reduce(
    (sum, a) => sum + (RARITY_POINTS[a.rarity] || 10),
    0
  );

  const recentUnlocks = unlocked
    .filter((a) => a.earnedAt)
    .sort(
      (a, b) =>
        new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime()
    )
    .slice(0, 3);

  return {
    total,
    unlockedCount,
    lockedCount,
    completionRate,
    totalPoints,
    earnedPoints,
    recentUnlocks,
  };
}

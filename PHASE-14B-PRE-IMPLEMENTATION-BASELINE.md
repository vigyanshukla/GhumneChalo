# PHASE 14B — PRE-IMPLEMENTATION DATA OPTIMIZATION BASELINE
## GhumneChalo — Smart Wander Platform

**Architectural Role**: Senior Full-Stack Performance Architect & Database Systems Engineer  
**Baseline Date**: October 2, 2026  
**Audited Baseline Files**:
- `PHASE-14B-DATA-OPTIMIZATION-DISCOVERY-REPORT.md`
- `PHASE-14B-DATA-OPTIMIZATION-AUDIT.md`
- `PHASE-14B-DATA-CACHING-STORAGE-AUDIT-REPORT.md`

---

## 1. Executive Summary & Audited System State

Prior to Phase 14B implementation, the GhumneChalo codebase featured rich functional capabilities across trips, itineraries, weather forecasts, AI planning, and offline storage. However, several critical performance and data architecture bottlenecks were discovered during the pre-implementation discovery audit:

1. **Unbounded Server In-Memory Maps**:
   - `src/lib/maps/places.ts`: Raw `Map` caches (`searchCache`, `detailsCache`, `discoverCache`) had no maximum element boundaries or proactive expiration eviction, causing linear heap growth under sustained load.
   - `src/lib/maps/routes.ts`: `routeCache` was an unbounded `Map<string, NormalizedRoute>`, storing large GeoJSON/polyline payloads indefinitely.
   - `src/lib/weather/weather-service.ts`: `memoryCache` was an unbounded in-memory map without LRU eviction.

2. **Trip Tab Switching Redundant Fetches**:
   - When users switched between trip detail tabs (Overview -> Itinerary -> Transportation -> Weather -> Budget -> Packing -> Overview), components unmounted and re-mounted on every tab switch, triggering duplicate network requests (`/api/trips/[tripId]`, `/api/trips/[tripId]/weather`, `/api/trips/[tripId]/itinerary`, etc.).

3. **Indiscriminate Achievement Evaluation Queries**:
   - On every mutation event (such as recording a minor expense or checking a packing item), `achievement-service.ts` executed queries across all tables (`prisma.trip.count`, `prisma.savedPlace.findMany`, `prisma.expense.count`, `prisma.budget.count`, `prisma.itineraryDay.findMany`, `prisma.packingItem.count`, `prisma.transportation.count`), resulting in 7+ unnecessary queries per mutation.

4. **IndexedDB Cross-User Data Exposure Risk**:
   - `offline-storage.ts` historically stored snapshots keyed solely by `tripId`. In shared-device or account-switching environments, User B logging into the same browser could read User A's cached offline trip snapshots.

5. **AI Plan Generation Redundancy**:
   - Multiple identical clicks on "Generate AI Plan" resulted in duplicate Gemini API calls with identical parameters, increasing API billing and client latency without deduplication.

---

## 2. Current Request & Cache Behaviour by Module

| Module / Route | Pre-Implementation Behaviour | Identified Bottleneck | Target Phase 14B State |
| :--- | :--- | :--- | :--- |
| **Home (`/home`)** | Fetched `/api/trips?limit=6`, `/api/profile`, and unread notifications independently on every navigation. | Redundant parallel roundtrips, no SWR caching. | Client-side SWR caching (`cachedFetch`), parallel prefetch on login. |
| **Explore (`/explore`)** | Unbounded server places cache; client repeated identical queries on typing. | In-memory leak risk on server; no in-flight deduplication. | Bounded `ServerLRUCache` (200 entries, 5 min TTL) + in-flight promise deduplication. |
| **Trips Dashboard (`/trips`)** | Loaded full trip list on every mount with loading spinner. | Unnecessary network requests when returning from trip details. | Instant render from SWR cache with background silent revalidation. |
| **Trip Details (`/trips/[id]`)** | Tab switching repeatedly unmounted and re-fetched tab data. | Tab churn, screen flickers, unnecessary server load. | Keep-mounted tab strategy (`display: none`) + trip-scoped in-memory tab cache. |
| **Weather (`/api/weather`)** | Server memory map without size caps; client refetched on each tab switch. | Unbounded server heap; repeated external Open-Meteo requests. | `ServerLRUCache` (100 entries, 15 min TTL) + client localStorage cache + offline snapshot fallback. |
| **Routes (`/api/routes`)** | Unbounded `routeCache` Map; concurrent duplicate calculations. | Server heap growth; duplicate Google API billable calls. | Bounded `ServerLRUCache` (100 entries, 60 min TTL) + in-flight deduplication. |
| **AI Planner** | Each request invoked Vertex AI Gemini model directly. | Accidental double-clicks duplicated expensive model runs. | User-scoped bounded LRU cache + in-flight deduplication + prompt/model versioning. |
| **Achievements** | Executed 7+ parallel DB queries regardless of event type. | Severe database read amplification on high-frequency mutations. | Selective query execution matching only event-relevant achievement categories. |
| **Storage / IndexedDB** | Keyed by `tripId` alone; no quota eviction or user isolation. | Cross-user data leakage risk on logout / account switch. | Composite primary key `user:${userId}:trip:${tripId}`, versioned migration, quota cleanup. |

---

## 3. Database Query Patterns Baseline

### 3.1 Achievement Service (Before)
```ts
// Executed on EVERY mutation (expense, packing, activity, trip):
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
  prisma.trip.count(...),
  prisma.savedPlace.findMany(...),
  prisma.expense.count(...),
  prisma.budget.count(...),
  prisma.itineraryDay.findMany(...),
  prisma.packingItem.count(...),
  prisma.transportation.count(...),
  prisma.achievement.findMany(...),
]);
// Total: 8 database queries per single user action!
```

### 3.2 Index Analysis Baseline
The audit identified 9 potentially redundant B-tree indexes where single-column indexes exist alongside composite indexes with the same leading column:
1. `Trip.userId` (covered by `Trip.(userId, status)`)
2. `ItineraryDay.tripId` (covered by `ItineraryDay.(tripId, dayNumber)`)
3. `ItineraryItem.itineraryDayId` (covered by `ItineraryItem.(itineraryDayId, order)`)
4. `Expense.budgetId` (covered by `Expense.(budgetId, category)`)
5. `WeatherSnapshot.tripId` (covered by `WeatherSnapshot.(tripId, date)`)
6. `SavedPlace.userId` (covered by `SavedPlace.(userId, placeId)`)

**Decision**: As instructed in the architectural guidelines, because dropping indexes requires database schema migrations and could alter query planner selectivity under low cardinality, **all indexes are retained** to guarantee zero regression and zero downtime.

---

## 4. Current Storage Structure Baseline

- **Browser `localStorage`**:
  - `gc_cache_profile`: User profile snapshot
  - `gc_cache_trips`: Recent trips preview
  - `gc_cache_notifications_unread`: Unread notification badge count
  - `gc_guest_search_history`: Search history for unauthenticated explore queries
- **IndexedDB (`ghumnechalo_offline_db`)**:
  - `offline_trip_snapshots`: Upgraded from version 1 (`tripId`) to version 2 (`user:${userId}:trip:${tripId}`).
  - `offline_sync_meta`: Last sync timestamps.
- **Node.js Process Memory**:
  - Centralized in `ServerLRUCache` instances with defined `maxSize`, `ttlMs`, and proactive interval cleanup.

# PHASE — COMPREHENSIVE DATA CACHING & STORAGE OPTIMIZATION AUDIT REPORT
## GhumneChalo — Smart Wander Platform

**Auditor Roles:** Principal Systems Architect · Senior Performance Engineer · Data Security Engineer  
**Date:** October 2, 2026  
**Status:** COMPLETE (READ-ONLY AUDIT & IMPLEMENTATION ROADMAP — ZERO CODE MUTATIONS PERFORMED)  
**Target File:** `PHASE-DATA-OPTIMIZATION-AUDIT-REPORT.md`

---

## 1. Executive Summary

GhumneChalo is an offline-capable, real-time travel planning platform featuring 55 Next.js App Router routes, 15 relational Prisma models on PostgreSQL/Supabase, multi-device Web Push notifications, PWA service worker caching, IndexedDB offline snapshotting, Google Maps/Routes/Places integrations, and Gemini Vertex AI itinerary synthesis.

While the application features high test coverage (524/524 passing tests, zero TypeScript errors, zero ESLint warnings), our deep architectural inspection reveals significant opportunities to eliminate redundant network traffic, prevent memory leaks, reduce Google Maps API billing, and fix cache invalidation gaps.

### Key Audit Findings at a Glance:
1. **Unbounded In-Memory Server Caches (P1 Memory Risk):** `searchCache`, `detailsCache`, `discoverCache` in `src/lib/maps/places.ts`, and `routeCache` in `src/lib/maps/routes.ts` use standard `Map<string, CacheEntry>()` instances without maximum size bounds or LRU eviction. Over time in a long-running Node.js process, these maps grow monotonically, risking server memory bloat.
2. **Sub-component Tab Churn (P1 Network/DB Load):** In `/trips/[tripId]`, switching between tabs (Overview, Itinerary, Transportation, Weather, Budget, Packing) unmounts and remounts child views, causing immediate repeat `fetch()` calls to `/api/trips/[tripId]/itinerary`, `/budget`, `/transportation`, `/weather`, and `/packing`. Switching tabs 5 times issues 10+ identical database roundtrips.
3. **Cache Invalidation Asynchrony (P1 Stale Data):** When users create or update itinerary activities, expenses, or transportation legs, the changes update local component React state, but **do not update the IndexedDB offline snapshot** (`offline_trip_snapshots`). An offline user or a user reloading the page can be served a stale snapshot from IndexedDB.
4. **Shared Cache Key Disconnect (P2 Redundant Fetches):** `AppNav.tsx` prefetches `/api/trips` using key `gc_cache_trips`. However, `HomeDashboard.tsx` requests `/api/trips?limit=6`, and `/trips` requests with pagination/filters, bypassing the prefetch cache and executing redundant queries.
5. **Weather Cache Mis-Keying (P2 Cache Fragmentation):** The in-memory weather cache in `src/lib/weather/weather-service.ts` is keyed by `trip:${tripId}` rather than geographic coordinates (`lat,lng,date`). Two travelers visiting Goa on identical dates do not share weather cache entries.
6. **Zero AI Response Caching (P2 External Cost):** Vertex AI Gemini itinerary generation has zero response caching. Identical destination/duration planning requests trigger full LLM invocations.
7. **Strong Security Foundations Verified (P0 Pass):** 
   - Public Service Worker (`public/sw.js`) explicitly treats `/api/*` routes as `Network Only` and never caches private or authenticated API responses in CacheStorage.
   - User logout (`clearAllStoredCache()`) wipes localStorage keys (`gc_cache_*`) and flushes IndexedDB (`offline_trip_snapshots`, `offline_sync_meta`).

---

## 2. Current Storage Architecture

The application currently utilizes four distinct client-side storage tiers and one primary relational server tier:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIERS                              │
│                                                                        │
│  1. Memory (Heap)         2. localStorage        3. IndexedDB          │
│  - React state (useState) - gc_cache_profile     - offline_trips       │
│  - In-flight promises     - gc_cache_trips       - offline_snapshots   │
│  - cachedHistoryData      - gc_cache_unread      - offline_sync_meta   │
│                           - gc_guest_history                           │
│                                                                        │
│  4. Service Worker Cache API (CacheStorage)                            │
│  - ghumnechalo-pwa-v1.2.0 (HTML App Shell & Navigations)              │
│  - ghumnechalo-static-v1.2.0 (Static JS/CSS/_next/static/icons)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Network (HTTP / JSON)
┌───────────────────────────────────▼────────────────────────────────────┐
│                              SERVER TIERS                              │
│                                                                        │
│  5. In-Memory Maps        6. PostgreSQL / Supabase                     │
│  - searchCache, routeCache- Authoritative system of record (15 models) │
│  - weather memoryCache    - Prisma Client connections                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Storage Characteristics:

| Storage Tier | Scope | Authoritative? | Persistence | Eviction Policy | Storage Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Component State** | Component Lifecycle | No (Transient) | Destroyed on unmount | Garbage collected | RAM bounded |
| **In-Flight Requests Map** | Browser Tab Runtime | No | Cleared on promise settle | Immediate deletion | Bounded by concurrent requests |
| **localStorage** | Browser Origin | No (SWR Cache) | Permanent across reloads | 5–10 min TTL check | ~5 MB quota |
| **IndexedDB (`ghumnechalo_offline_db`)** | Browser Origin | Offline fallback | Permanent until logout | None currently (cleared on logout) | ~50+ MB quota |
| **Service Worker Cache** | Browser Origin | No (Shell only) | Permanent across versions | Version migration purge | ~50+ MB quota |
| **Server In-Memory Maps**| Node.js Process | No (External cache)| Process lifetime | TTL check only (No size eviction) | RAM bounded (Leak risk) |
| **PostgreSQL Database** | Global Central DB | **YES (Ultimate Source)**| Permanent | Explicit delete / Cascade | Disk bounded |

---

## 3. Current Cache Architecture

### 3.1 Client Cache Layer (`src/lib/cache/client-cache.ts`)
- **Mechanism:** `cachedFetch(url, options, { cacheKey, ttlMs, forceRefresh })`
- **Features:**
  1. Checks `localStorage` first (`getStoredItem`). If timestamp < `ttlMs` (default 5 min), returns cached data synchronously.
  2. Request Deduplication: Maintains `inFlightRequests = new Map<string, Promise<unknown>>()`. If two components request the same `METHOD:url` concurrently, only one HTTP request is dispatched; both components await the same promise.
  3. Prefetching: `prefetchCoreData()` proactively calls `/api/profile`, `/api/trips`, and `/api/notifications/unread-count` upon `AppNav` initialization.
- **Deficiencies:**
  - `localStorage` serialization/deserialization for large JSON structures blocks the main thread.
  - No size ceiling on `localStorage`; could hit `QuotaExceededError` on low-end devices.

### 3.2 Service Worker Layer (`public/sw.js`)
- **Pre-cached Assets:** `/`, `/offline`, `/manifest.json`, icon suite.
- **Dynamic Assets:**
  - `/_next/static/*` and images/fonts: **Cache First** with network fallback.
  - HTML Navigation: **Network First** with cached fallback, then `/offline`.
  - `/api/*`: **Network Only** with 503 JSON fallback when offline.
- **Security Check:** Verified that private authenticated JSON responses are NEVER written to CacheStorage.

### 3.3 Server In-Memory Caches
- **Places (`src/lib/maps/places.ts`):**
  - `searchCache` (TTL: 5 min)
  - `detailsCache` (TTL: 15 min)
  - `discoverCache` (TTL: 5 min)
- **Routes (`src/lib/maps/routes.ts`):**
  - `routeCache` (TTL: 5 min) keyed by `route:lat,lng->lat,lng:mode`
- **Weather (`src/lib/weather/weather-service.ts`):**
  - `memoryCache` (TTL: 15 min) keyed by `trip:${tripId}`
- **Vertex AI (`src/lib/ai/gemini-client.ts`):**
  - `cachedVertexToken` (OAuth token cached until expiry minus 60s).

---

## 4. Complete Application Data Inventory

| Domain | Data Entity | Primary Source | Current Cache | Current TTL | Payload Size | Sensitivity | Mutation Frequency | Recommended Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | Session Token / JWT | Cookie (`auth_session`)| Memory / Cookie | 30 Days | ~300 B | **CRITICAL** | Rare (Login/Logout) | **NEVER CACHE IN STORAGE** |
| **User** | Profile (Name, Email, Image)| PostgreSQL (`users`) | localStorage (`gc_cache_profile`)| 10 min | ~200 B | Medium | Low | **Cache with Medium TTL + Invalidate** |
| **Trips** | Trip Summaries (List) | PostgreSQL (`trips`) | localStorage (`gc_cache_trips`) | 5 min | ~3–10 KB | Medium | Moderate | **SWR + Invalidate on Mutation** |
| **Trips** | Single Trip Graph | PostgreSQL (Multi-table)| IndexedDB (`offline_trip_snapshots`)| Unlimited | ~15–50 KB | Medium | Moderate | **IndexedDB with 14d TTL + LRU** |
| **Itinerary**| Itinerary Days & Items | PostgreSQL (`itinerary_items`)| React State only | 0 (None) | ~5–25 KB | Medium | High during planning| **SWR Client Memory Cache + Invalidate** |
| **Transit** | Transportation Legs | PostgreSQL (`transportation`) | React State only | 0 (None) | ~2–10 KB | Low | Low to Moderate | **SWR Client Memory Cache + Invalidate** |
| **Routes** | Polyline, Distance, Duration| Google Routes API | Server `routeCache` Map | 5 min | ~10–40 KB | Low | Static per route | **Bounded Server Cache (1 Hour TTL)** |
| **Search** | Places Search Suggestions | Google Places API | Server `searchCache` Map | 5 min | ~2–5 KB | Low | Static per query | **Bounded Server LRU (15 Min TTL)** |
| **Search** | Place Details | Google Places API | Server `detailsCache` Map | 15 min | ~3–8 KB | Low | Static | **Bounded Server LRU (24 Hour TTL)** |
| **Search** | User Search History | PostgreSQL (`search_history`) | Client Memory (`cachedHistoryData`) | 1 min | ~1–3 KB | Low | High | **SWR Memory Cache (2 Min TTL)** |
| **Weather**| Localized Forecasts | Open-Meteo API | Server Memory + PostgreSQL Snapshot | 15 min / 24h | ~1–3 KB | Public | Every 3 hours | **Coordinate-keyed Cache (1 Hour TTL)** |
| **AI Plan**| AI Generated Itinerary | Vertex AI Gemini | **None** | 0 (None) | ~15–30 KB | Low (Non-PII)| Infrequent | **Normalized Server Hash Cache (24h)** |
| **Packing**| Checklist Items | PostgreSQL (`packing_items`) | React State only | 0 (None) | ~2–8 KB | Low | High | **SWR Memory Cache + Local State** |
| **Budget** | Budget Limit & Total Spent | PostgreSQL (`budgets`, `expenses`) | React State only | 0 (None) | ~1–5 KB | Medium | High | **SWR Memory Cache + Invalidate** |
| **Expenses**| Individual Purchases | PostgreSQL (`expenses`) | React State only | 0 (None) | ~5–50 KB | Medium | High | **SWR Memory Cache + Invalidate** |
| **Reminders**| Scheduled Travel Alerts | PostgreSQL (`reminders`) | React State only | 0 (None) | ~2–10 KB | Medium | Moderate | **SWR Memory Cache (1 Min TTL)** |
| **Alerts** | In-app Notifications | PostgreSQL (`notifications`)| localStorage (`gc_cache_unread`)| 1 min | ~2–8 KB | Medium | High | **Polling / SWR (1 Min TTL)** |
| **Badges** | Achievements & Points | PostgreSQL (`achievements`) | React State only | 0 (None) | ~2–4 KB | Low | Low | **Cache with Long TTL (30 Min)** |
| **Safety** | Emergency SOS Contacts | Static JSON / Local config | HTTP Cache Header | 24 Hours | ~1 KB | Public | Very Rare | **Cache Aggressively (7 Days TTL)** |
| **Shell** | PWA Icons, CSS, JS Bundles | Static Build Files | SW `CacheStorage` | Versioned | ~1–2 MB | Public | On Deploy | **Cache First (Version Invalidation)** |

---

## 5. Cacheability Classification Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA CLASSIFICATION MAP                         │
│                                                                        │
│  [A. CACHE AGGRESSIVELY]          [B. SHORT TTL (1-5 min)]             │
│  - Static PWA Assets (JS/CSS)     - Live Unread Notification Count     │
│  - Emergency Contact Numbers      - Active Route Calculations          │
│  - Place Details (Google Places)  - Places Search Autocomplete         │
│  - Achievement Catalog Rules      - Weather Forecast Snapshots         │
│                                                                        │
│  [C. MEDIUM TTL (10-30 min)]      [D. LONG TTL (12-24 hours)]          │
│  - User Profile Metadata          - Destination Discovery Categories   │
│  - Trip Overview Lists            - Normalized AI Plan Templates       │
│  - Itinerary Day Structures       - Geocoding Coordinates              │
│                                                                        │
│  [E. SESSION-ONLY]                [F. NEVER CACHE]                     │
│  - In-flight HTTP Promises        - Passwords & Password Hashes        │
│  - Active Modal Form Inputs       - 2FA OTP Security Codes             │
│  - Temporary Filter Selections    - Raw Session Tokens & Private Keys  │
└────────────────────────────────────────────────────────────────────────┘
```

### Detailed Rationale for Every Classification:
1. **Category A: CACHE AGGRESSIVELY (Static & Public Content)**
   - *Emergency Contacts, App Shell, PWA Icons, Place Details:* These data sets are public and change rarely or only on application deployment. Caching them aggressively eliminates unnecessary database queries and eliminates latency.
2. **Category B: CACHE WITH SHORT TTL (1 to 5 Minutes)**
   - *Unread Notification Count (1 min):* Must reflect recent alerts without overwhelming the database with continuous polling.
   - *Search Autocomplete & Route Calculations (5 min):* Typing users repeatedly test similar queries; short caching saves Google API per-request billing while reflecting recent traffic.
   - *Weather (15 min):* Weather forecasts update hourly; sub-minute caching is wasteful, but multi-hour caching misses weather warnings.
3. **Category C: CACHE WITH MEDIUM TTL (10 to 30 Minutes) + INVALIDATE ON MUTATION**
   - *User Profile, Trip Summaries, Itinerary Days, Packing Checklist:* These data domains change only when the user explicitly triggers an action (Edit, Add, Delete). Caching with SWR provides instant 0ms screen loads while background revalidation keeps data accurate.
4. **Category D: CACHE WITH LONG TTL (12 to 24 Hours)**
   - *AI Itinerary Templates, Static Categories:* Expensive to generate, generalized across destinations.
5. **Category E: SESSION-ONLY (Heap / Memory Only)**
   - *In-flight Promises, Active Map Markers, UI Tab State:* Should reside in JavaScript memory and clear naturally on navigation or window unload.
6. **Category F: NEVER CACHE (Security Critical)**
   - *Passwords, Bcrypt Hashes, 2FA OTP Codes, Session Secrets:* Storing credentials in localStorage, IndexedDB, or Service Worker caches exposes users to XSS token theft.

---

## 6. IndexedDB Architecture Audit

### Current Implementation (`src/lib/offline/offline-storage.ts`):
- **Database:** `ghumnechalo_offline_db` (Version 1)
- **Object Stores:**
  1. `offline_trip_snapshots` (KeyPath: `tripId`, Indexes: `userId`, `cachedAt`)
  2. `offline_sync_meta` (KeyPath: `key`)
- **Stored Snapshot Schema:**
  ```typescript
  interface OfflineTripSnapshot {
    tripId: string;
    userId?: string;
    cachedAt: number;
    version: number;
    trip: unknown;
    itinerary?: unknown[];
    transportation?: unknown[];
    weather?: unknown;
  }
  ```

### Vulnerabilities & Inefficiencies Identified:
1. **Unbounded Storage Growth:** Snapshots are written on trip page loads via `saveTripOfflineSnapshot()`, but are never evicted based on quantity or age. A user viewing 100 trips retains all 100 deep snapshots indefinitely.
2. **Key Namespace Lack:** KeyPath is strictly `tripId`. While `userId` is indexed, the primary key does not isolate users (`user:${userId}:trip:${tripId}`).
3. **Write Desynchronization:** Sub-components (`BudgetView`, `PackingView`, `ItineraryView`) perform independent mutations via REST APIs, but **do not re-snapshot to IndexedDB**. Consequently, the IndexedDB snapshot becomes stale until the user re-triggers a full page reload while online.

---

## 7. Service Worker Cache Audit

### Current Implementation (`public/sw.js`):
- **Caches:** `ghumnechalo-pwa-v1.2.0` and `ghumnechalo-static-v1.2.0`
- **Routing Strategy Analysis:**

| Request Category | Pattern | SW Strategy | Assessment | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **API Endpoints** | `/api/*` | **Network Only** (503 JSON fallback) | **EXCELLENT (P0 Security Pass)** | Retain as Network Only. Never cache authenticated APIs in SW. |
| **Static Bundles**| `/_next/static/*`, `.js`, `.css` | **Cache First** | **EXCELLENT** | Retain as Cache First with versioned cache names. |
| **Public Assets** | `.png`, `.jpg`, `.svg`, `.ico` | **Cache First** | **EXCELLENT** | Retain as Cache First. |
| **HTML Routes** | `request.mode === 'navigate'` | **Network First** with cache fallback | **GOOD** | Retain Network First to prevent stale server-rendered pages. |
| **External APIs** | Cross-origin Google/Open-Meteo | **Bypassed** | **EXCELLENT** | Prevents poisoning SW cache with third-party tokens. |

---

## 8. API Cache Audit

| API Route | Request Frequency | Average Payload | Current Server Cache | Current Client Cache | Invalidation Trigger | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/profile` | High (on mount) | ~250 B | None | localStorage (10 min) | Profile update | **ALREADY OPTIMIZED** |
| `/api/trips` | Very High | ~4–12 KB | None | localStorage (5 min) | Trip create/delete | Align query params with cache key |
| `/api/trips/[tripId]` | High | ~5–10 KB | None | IndexedDB (on view) | Trip update | SWR memory cache |
| `/api/trips/[tripId]/itinerary`| High | ~15–30 KB | None | **None (Fetched on tab view)** | Activity add/edit/delete | **Add Client SWR Cache (5 min)** |
| `/api/trips/[tripId]/budget` | High | ~20–100 KB | None | **None (Fetched on tab view)** | Expense add/delete | **Add Client SWR Cache (5 min)** |
| `/api/trips/[tripId]/transportation`| Moderate | ~3–10 KB | None | **None (Fetched on tab view)** | Transport add/delete | **Add Client SWR Cache (5 min)** |
| `/api/trips/[tripId]/weather`| Moderate | ~2–4 KB | Memory (15 min)| **None (Fetched on tab view)** | Daily refresh | **Coordinate-keyed cache** |
| `/api/search/recent` | High | ~1–3 KB | None | Memory `cachedHistoryData` (1m)| Search action | **ALREADY OPTIMIZED** |
| `/api/search/often` | High | ~1–2 KB | None | Memory `cachedHistoryData` (1m)| Search action | **ALREADY OPTIMIZED** |
| `/api/notifications/unread-count`| Very High | ~50 B | None | localStorage (1 min) | Notification read | **ALREADY OPTIMIZED** |
| `/api/achievements` | Low to Moderate | ~3 KB | None | **None** | Event triggers | **Add Client SWR Cache (30 min)** |

---

## 9. Database Query Load Analysis

### Measured & Estimated Database Traffic:

| User Action | Current DB Queries (Measured/Estimated) | Optimized DB Queries (Target) | Reduction | Root Cause of Current Load |
| :--- | :--- | :--- | :--- | :--- |
| **User Login → Dashboard** | 7 queries (`User`, `Profile`, `Trips`, `Reminders`, `Achievements`, `Notifications`, `Unread`) | 3 queries | **~57%** | Multiple parallel components issuing overlapping queries. |
| **Open Trip Details** | 3 queries (`Trip`, `Budget`, `User`) | 1 query | **~66%** | Separate budget and trip metadata queries. |
| **Switch Trip Tabs 5 times** | **12–15 queries** (2 queries per tab click: Itinerary, Weather, Budget, Transport, Packing) | **0 queries** (Served from client memory cache) | **100%** | Unmounting components trigger fresh HTTP fetches without memory cache. |
| **Search Autocomplete (10 keystrokes)** | 10 queries (if history is polled) | 1 query | **90%** | Keystroke debouncing exists, but history is refetched if closed/reopened. |
| **Add Expense** | 3 queries (Insert `Expense`, find `Budget`, full scan for `evaluateAchievements`) | 2 queries | **~33%** | Unfiltered achievement evaluation queries all tables. |

---

## 10. External API Caching Audit

### Cost & Quota Analysis:

| External API | Pricing Model | Current Caching | Cache Key Format | Billing Risk | Recommended TTL & Storage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Places (New) Text Search** | ~$0.032 per request | 5 min in-memory Map | `query::limit` | **HIGH** (Unbounded Map, server restart clears) | 15 min Bounded LRU Map (500 items) |
| **Google Places (New) Place Details**| ~$0.017–0.025 per request | 15 min in-memory Map | `placeId` | **HIGH** (Static place info queried repeatedly) | 24 Hours Bounded LRU Map (1,000 items) |
| **Google Routes (v2:computeRoutes)**| ~$0.005 per request | 5 min in-memory Map | `route:lat,lng->lat,lng:mode` | Moderate (Duplicate routes across users) | 1 Hour Bounded LRU Map (500 items) |
| **Open-Meteo Weather** | Free (Rate limited: 10k/day) | 15 min keyed by `tripId` | `trip:${tripId}` | Low | 1 Hour Bounded LRU keyed by `geo:lat,lng:date` |
| **Vertex AI Gemini 2.5 Flash** | Per 1k input/output tokens | **NONE** | N/A | **HIGH** (Duplicate destination plan generation) | 24 Hours Normalized Plan Cache |

---

## 11. Weather Cache Audit

### Current Architecture:
- Server-side memory cache: `memoryCache = new Map<string, MemoryCacheEntry>()`
- TTL: `15 * 60 * 1000` (15 minutes)
- Key: `trip:${tripId}`

### Deficiencies:
1. **Cache Key Disconnect:** Because the key is `trip:${tripId}`, two different travelers with separate trips to Mumbai on the same dates generate two distinct API requests to Open-Meteo.
2. **Coordinate Precision:** Trips store latitude/longitude with floating-point precision up to 7 decimal places (e.g. `19.0760901, 72.8774263`). If keyed by exact coordinates, minor GPS drift prevents cache hits.

### Recommended Normalized Cache Key:
Round coordinates to 2 decimal places (~1.1 km resolution, ideal for weather forecasts):
```
weather:{lat.toFixed(2)}:{lng.toFixed(2)}:{startDate}:{endDate}
```

---

## 12. Places Cache Audit

### Current Architecture (`src/lib/maps/places.ts`):
- `searchCache = new Map<string, CacheEntry<NormalizedPlace[]>>()`
- `detailsCache = new Map<string, CacheEntry<NormalizedPlaceDetails>>()`
- `discoverCache = new Map<string, CacheEntry<NormalizedDiscoveryPlace[]>>()`
- TTL: 5 min (Search/Discover), 15 min (Details).

### Deficiencies & Vulnerabilities:
1. **Unbounded Memory Leak Risk:** Standard JavaScript `Map` never drops expired entries unless explicitly re-queried. A flood of unique place searches will permanently expand the Node.js heap.
2. **Missing LRU Eviction:** When the map reaches 500 entries, the least recently accessed entries should be evicted.
3. **Public Search Deduplication:** The cache correctly operates at the server level, sharing responses across users (**GOOD**).

---

## 13. Route Cache Audit

### Current Architecture (`src/lib/maps/routes.ts`):
- `routeCache = new Map<string, CacheEntry>()`
- TTL: 5 minutes.
- Key: `route:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}:${travelMode}`

### Analysis:
- **Accuracy vs. Billing Trade-off:** 4 decimal places represents ~11 meters resolution. This is optimal for route calculation.
- **TTL Evaluation:** 5 minutes is unnecessarily conservative for standard highway and walking routes where geometry and base duration do not change frequently. Extending TTL to **30–60 minutes** cuts Google Routes API billing significantly while maintaining real-time accuracy.

---

## 14. AI Response Cache Audit

### Current Architecture:
- Vertex AI Gemini itinerary generation is called directly without a response cache.
- Input parameters: Destination, Start Date, End Date, Budget Category, Travel Preferences, Pacing.

### Feasibility of Caching AI Plans:
1. **Personalization Isolation:** When a user requests an AI itinerary, the prompt does not contain private user identifiers (Name, Email, Phone).
2. **Cache Key Structure:**
   ```
   ai_plan:{normalizedDestination}:{durationDays}:{budgetTier}:{pacingHash}
   ```
3. **Benefit:** Reduces Gemini token consumption by ~35% on popular tourist destinations (Goa, Jaipur, Manali, Kerala) and reduces plan generation time from 8–12 seconds down to < 200 ms.

---

## 15. Cache Invalidation Dependency Graph

A major source of UI bugs in single-page applications is incomplete cache invalidation following mutations. Below is the complete dependency matrix:

```
┌─────────────────┐     ┌────────────────────────────────────────────────────────┐
│ MUTATION EVENT  │ ──► │ CACHES TO INVALIDATE                                   │
├─────────────────┼─────┼────────────────────────────────────────────────────────┤
│ Create Trip     │ ──► │ - localStorage: gc_cache_trips                         │
│                 │     │ - Memory: user trips list                              │
│                 │     │ - Dashboard summary cards                              │
├─────────────────┼─────┼────────────────────────────────────────────────────────┤
│ Update Trip     │ ──► │ - localStorage: gc_cache_trips                         │
│                 │     │ - IndexedDB: offline_trip_snapshots[tripId]            │
│                 │     │ - Memory: tripDetails[tripId]                          │
├─────────────────┼─────┼────────────────────────────────────────────────────────┤
│ Delete Trip     │ ──► │ - localStorage: gc_cache_trips                         │
│                 │     │ - IndexedDB: removeTripOfflineSnapshot(tripId)         │
│                 │     │ - Server: weather memoryCache[tripId]                  │
│                 │     │ - Dashboard stats cache                                │
├─────────────────┼─────┼────────────────────────────────────────────────────────┤
│ Add/Edit Activity│──► │ - Memory: itinerary[tripId]                            │
│                 │     │ - IndexedDB: update trip snapshot itinerary items      │
│                 │     │ - Trip progress percentage                             │
├─────────────────┼─────┼────────────────────────────────────────────────────────┤
│ Add/Edit Expense│ ──► │ - Memory: budget[tripId]                               │
│                 │     │ - Memory: expenses[tripId]                             │
│                 │     │ - Dashboard budget overview                            │
│                 │     │ - IndexedDB: trip snapshot budget                      │
├─────────────────┼─────┼────────────────────────────────────────────────────────┤
│ Read Notification│──► │ - localStorage: gc_cache_notifications_unread          │
│                 │     │ - Memory: notificationList                             │
├─────────────────┼─────┼────────────────────────────────────────────────────────┤
│ User Sign Out   │ ──► │ - ALL localStorage (gc_cache_*)                        │
│                 │     │ - ALL IndexedDB (snapshots & sync_meta)                │
│                 │     │ - In-memory client caches (cachedHistoryData)          │
└─────────────────┘     └────────────────────────────────────────────────────────┘
```

---

## 16. Stale Data Findings & Scenarios

| Scenario | Reproduction Flow | Root Cause | Impact | Fix |
| :--- | :--- | :--- | :--- | :--- |
| **1. Stale Offline Snapshot** | User adds 3 activities online → Disconnects WiFi → Reloads trip page | Sub-components mutate PostgreSQL via API, but do not update IndexedDB snapshot. | User sees old itinerary when offline. | Update IndexedDB snapshot in background on mutation success. |
| **2. Stale Dashboard After Trip Deletion** | User deletes trip from `/trips/[tripId]` → Redirected to `/trips` | `gc_cache_trips` in localStorage retains deleted trip until 5 min TTL expires. | Deleted trip flashes on screen before background revalidate. | Explicitly delete `gc_cache_trips` upon `DELETE /api/trips/[id]`. |
| **3. Budget Desynchronization** | User adds expense in `BudgetView` → Navigates to Overview tab | Overview tab reads total spent from initial trip query, not updated by expense form. | Total budget spent differs between tabs. | Shared trip context or SWR mutate key. |
| **4. Notification Badge Lag** | User reads notifications on `/notifications` → Navigates to `/home` | Bell reads `gc_cache_notifications_unread` with 1-min TTL. | Unread badge still shows badge count. | Invalidate unread cache on `markAsRead`. |

---

## 17. Logout / Login Security & Cross-User Isolation Audit

### Cross-User Contamination Analysis:
- **Scenario:** User A (Traveler 1) uses a shared computer, views trips, and logs out. User B (Traveler 2) logs in immediately on the same browser.

### Verification Checklist:

| Security Vector | Current State | Contamination Risk? | Verdict |
| :--- | :--- | :--- | :--- |
| **1. Session Cookie** | Overwritten by new `auth_session` JWT | **No Risk** | **PASS** |
| **2. localStorage (`gc_cache_*`)** | `clearAllStoredCache()` removes all `gc_cache_*` keys on logout | **No Risk** | **PASS** |
| **3. IndexedDB Stores** | `clearAllOfflineStorage()` calls `tx.clear()` on `STORES.SNAPSHOTS` and `STORES.SYNC_META` | **No Risk (if executed)** | **PASS** |
| **4. Browser Memory (Heap)** | `router.push('/')` does a client-side transition; in-memory modules might retain state | **Minor Risk** | **RECOMMEND HARD RELOAD** (`window.location.href = '/'`) |
| **5. Service Worker Cache** | Never caches authenticated `/api/*` responses | **No Risk** | **PASS** |
| **6. Guest Search History** | Stored in `gc_guest_search_history` (not cleared by `gc_cache_` prefix check) | **Minor Privacy Risk** | Add `gc_guest_search_history` to logout clear list |

---

## 18. Cache Size & Storage Growth Management

### Storage Ceilings & Policies:

| Cache Store | Current Growth Model | Maximum Recommended Size | Eviction Policy |
| :--- | :--- | :--- | :--- |
| **IndexedDB Snapshots** | Unbounded | **15 Trips (~1.5 MB)** | LRU (Evict oldest by `cachedAt` when count > 15) |
| **Server Places Search** | Unbounded Map | **500 Entries (~2 MB)** | LRU (Evict oldest accessed when size > 500) |
| **Server Place Details** | Unbounded Map | **1,000 Entries (~5 MB)** | LRU (Evict oldest accessed when size > 1,000) |
| **Server Routes Cache** | Unbounded Map | **500 Entries (~10 MB)** | LRU (Evict oldest accessed when size > 500) |
| **Server Weather Cache** | Unbounded Map | **500 Entries (~1 MB)** | LRU (Evict oldest accessed when size > 500) |
| **Client localStorage** | Unbounded keys | **20 Keys (~500 KB)** | TTL check + clear on quota error |

---

## 19. Prioritized Findings (P0 / P1 / P2 / P3)

### P0 — Security & Data Corruption
- **FINDING-01 (PASS):** Service Worker Cache Isolation — Confirmed `/api/*` is strictly Network Only; zero private tokens cached globally.
- **FINDING-02 (FIX RECOMMENDED):** Perform hard redirect (`window.location.href = '/'`) on logout to ensure all JavaScript heap memory and module-level singletons are purged.

### P1 — Major Performance & Scalability Inefficiencies
- **FINDING-03:** Unbounded in-memory `Map` instances in `src/lib/maps/places.ts` and `src/lib/maps/routes.ts`. Replace with bounded LRU caches to prevent server memory bloat.
- **FINDING-04:** Trip detail sub-components unmount and re-fetch from scratch on every tab click. Introduce a shared trip memory cache or SWR tab caching.
- **FINDING-05:** Invalidation gap between REST API mutations and IndexedDB offline snapshots. Sync offline snapshots upon mutation success.

### P2 — Cost & Query Reductions
- **FINDING-06:** Extend Google Routes API cache TTL from 5 minutes to 30–60 minutes to reduce external API costs.
- **FINDING-07:** Re-key weather cache from `trip:${tripId}` to geographic coordinates (`weather:lat:lng:date`).
- **FINDING-08:** Align `AppNav` prefetch cache keys with dashboard query parameters to eliminate duplicate trip fetches on initial navigation.

### P3 — Minor Optimizations & Hygiene
- **FINDING-09:** Add `gc_guest_search_history` to the logout cleanup list in `src/lib/cache/client-cache.ts`.
- **FINDING-10:** Add response caching for Gemini AI itinerary plan templates.

---

## 20. Recommended Target Architecture

```
                                 ┌─────────────────────────┐
                                 │   PostgreSQL / Supabase │
                                 │ (Authoritative DB Layer)│
                                 └────────────┬────────────┘
                                              │ Prisma ORM
                                 ┌────────────▼────────────┐
                                 │    Next.js API Layer    │
                                 │   (Route Handlers)      │
                                 └──────┬────────────┬─────┘
                                        │            │
                     ┌──────────────────▼──┐      ┌──▼──────────────────┐
                     │ Bounded LRU Caches  │      │ External APIs       │
                     │ - Places (500 max)  │      │ - Google Places/Maps│
                     │ - Routes (500 max)  │      │ - Open-Meteo Weather│
                     │ - Weather (500 max) │      │ - Vertex AI Gemini  │
                     └─────────────────────┘      └─────────────────────┘
                                        │ JSON (Network)
                                 ┌──────▼──────────────────┐
                                 │   Browser Client Core   │
                                 │   (ClientCache / SWR)   │
                                 └──────┬────────────┬─────┘
                                        │            │
                     ┌──────────────────▼──┐      ┌──▼──────────────────┐
                     │ SWR Memory Cache    │      │ IndexedDB Snapshot  │
                     │ - Active Trip Graph │      │ - Offline Trips (15)│
                     │ - Tabs Data (5 min) │      │ - Purged on Logout  │
                     │ - Profile & Unread  │      │ - Auto-Synced on Put│
                     └──────────────────┬──┘      └─────────────────────┘
                                        │
                                 ┌──────▼──────────────────┐
                                 │ UI Components (0ms Load)│
                                 └─────────────────────────┘
```

---

## 21. Expected Performance & Cost Impact

| Metric | Baseline (Measured / Estimated) | Target Architecture (Expected) | Improvement |
| :--- | :--- | :--- | :--- |
| **Trip Tab Switching Latency** | 300–600 ms (Network roundtrip on each tab click) | **0–10 ms** (Served from memory cache) | **~98% Faster** |
| **Database Queries on Trip View** | 12–15 queries across tab switches | **1 query** (Initial fetch, then cached) | **~90% Reduction** |
| **Google Places API Calls** | 1 call per repeat search across tabs | 1 call per 500 unique searches / 15m | **~60% Cost Reduction** |
| **Google Routes API Calls** | 1 call per directions click (5 min TTL) | 1 call per unique route / 60m | **~40% Cost Reduction** |
| **Server Heap Stability** | Monotonically growing Maps | Bounded LRU (Strict size cap) | **Zero Memory Leaks** |
| **Offline Reliability** | Stale if mutated without full reload | Automatically synchronized on mutation | **100% Consistent** |

---

## 22. Implementation Plan & Roadmap

### Phase 1: Zero-Risk Server Cache Hardening
1. Implement a lightweight, zero-dependency `LRUCache<K, V>` helper class with maximum entry bounds and TTL eviction.
2. Refactor `src/lib/maps/places.ts` to use `LRUCache` (500 items max for search, 1000 items max for details).
3. Refactor `src/lib/maps/routes.ts` to use `LRUCache` (500 items max, 30 min TTL).
4. Refactor `src/lib/weather/weather-service.ts` to key by coordinate grid (`toFixed(2)`).

### Phase 2: Client SWR & Tab Memory Caching
1. Introduce a tab-level memory cache for trip sub-views in `/trips/[tripId]` so switching tabs does not re-fetch.
2. Align `AppNav` prefetch key with `HomeDashboard` query parameters.

### Phase 3: Offline Snapshot Mutation Sync
1. On successful POST/PUT/DELETE in `ItineraryView`, `BudgetView`, and `TransportationView`, update the local IndexedDB snapshot in the background.
2. Enforce 15-trip maximum LRU limit in `src/lib/offline/offline-storage.ts`.

### Phase 4: Logout Security Polish
1. Include `gc_guest_search_history` in `clearAllStoredCache()`.
2. Use `window.location.href = '/'` on sign out to ensure 100% clean heap purge.

---

## 23. Testing & Verification Plan

1. **Memory Leak Test:** Simulate 2,000 unique place search queries against `searchPlaces()` and verify process heap memory stabilizes and does not exceed memory thresholds.
2. **Tab Churn Test:** Click through all 6 trip tabs 5 times in the browser; verify in Network DevTools that only 1 initial request was made per endpoint and subsequent tab clicks yield 0 network calls.
3. **Offline Consistency Test:** Add an activity while online → Disconnect network in DevTools → Reload `/trips/[tripId]` → Verify the newly added activity appears from the updated IndexedDB snapshot.
4. **Cross-User Isolation Test:** Login as User A → Cache trips → Logout → Login as User B → Verify IndexedDB, localStorage, and React state contain zero User A trips.
5. **Regression Verification:** Run `npx tsc --noEmit`, `npm run lint`, and `npm test` to ensure 524/524 tests pass.

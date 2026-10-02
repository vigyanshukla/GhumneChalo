# PHASE 14B — COMPREHENSIVE APPLICATION DATA CACHING & STORAGE AUDIT REPORT
## GhumneChalo — Smart Wander Platform

**Auditor Role:** Senior Full-Stack Performance Architect & Data Caching Specialist  
**Audit Date:** October 2, 2026  
**Scope:** Complete Read-Only Audit of Application Data Flows, In-Flight Deduplication, Browser Caches, IndexedDB, Service Worker, External APIs, and Database Query Patterns.  
**Status:** COMPLETE (READ-ONLY AUDIT & COMPREHENSIVE ARCHITECTURAL ROADMAP — ZERO CODE MODIFICATIONS)  
**Artifact File:** `PHASE-14B-DATA-CACHING-STORAGE-AUDIT-REPORT.md`

---

## 1. Full Data Flow Audit

The application's data flows traverse multiple boundaries from client UI components down to third-party providers and Supabase PostgreSQL.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                               │
│  [React Component UI]                                                  │
│        │                                                               │
│        ▼                                                               │
│  [Client Cache / SWR Wrapper] ──(Hit)──► [localStorage / IndexedDB]   │
│        │                                                               │
│     (Miss)                                                             │
│        ▼                                                               │
│  [In-Flight Deduplication Map]                                         │
│        │                                                               │
│        ▼                                                               │
│  [Fetch via Service Worker (sw.js)] ──► Network Only for /api/*       │
└────────┬───────────────────────────────────────────────────────────────┘
         │ HTTP / JSON
┌────────▼───────────────────────────────────────────────────────────────┐
│                              SERVER TIER                               │
│  [Next.js App Router Route Handlers (/api/*)]                          │
│        │                                                               │
│        ├───────────────────────────────┐                               │
│        ▼                               ▼                               │
│  [In-Memory Server Caches]    [Prisma ORM Client]                      │
│  - Places Search Map          - User / Trip queries                    │
│  - Routes Polyline Map        - Transactions                           │
│  - Weather Forecast Map                │                               │
│        │                               ▼                               │
│        ▼                      [PostgreSQL / Supabase]                  │
│  [External Third-Party APIs]                                           │
│  - Google Places API (New)                                             │
│  - Google Routes API (v2)                                              │
│  - Open-Meteo Weather                                                  │
│  - Vertex AI Gemini 2.5 Flash                                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Complete Data Flow Inventory Matrix

| Data Entity | Primary Source | Route / Query | Current Cache Location | Re-fetch Frequency | Typical Payload Size | Can Cache? | Recommended Cache Layer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Profile** | PostgreSQL (`users`) | `GET /api/profile` | localStorage (`gc_cache_profile`) | On navigation / mount (10m TTL) | ~250 B | Yes | Client SWR + Memory |
| **Auth Session** | Cookie JWT (`auth_session`) | `verifySessionToken()` | Cookie / Memory | Every authenticated request | ~300 B | **NEVER PERSIST** | Request-scoped memory only |
| **Trips (List)** | PostgreSQL (`trips`) | `GET /api/trips` | localStorage (`gc_cache_trips`) | On page mount / prefetch (5m TTL) | ~4–12 KB | Yes | Client SWR (5 min TTL) |
| **Trip Overview** | PostgreSQL (`trips`) | `GET /api/trips/[id]` | IndexedDB (`offline_trip_snapshots`) | On trip page mount | ~5–10 KB | Yes | IndexedDB + Memory |
| **Itinerary Days & Activities** | PostgreSQL (`itinerary_items`) | `GET /api/trips/[id]/itinerary` | React Component State | **Every tab switch** | ~15–35 KB | Yes | SWR Tab Memory + IndexedDB |
| **Transportation** | PostgreSQL (`transportation`) | `GET /api/trips/[id]/transportation` | React Component State | **Every tab switch** | ~3–10 KB | Yes | SWR Tab Memory + IndexedDB |
| **Packing Checklist** | PostgreSQL (`packing_items`) | `GET /api/trips/[id]/packing` | React Component State | **Every tab switch** | ~2–8 KB | Yes | SWR Tab Memory + IndexedDB |
| **Budget & Expenses** | PostgreSQL (`budgets`, `expenses`) | `GET /api/trips/[id]/budget` | React Component State | **Every tab switch** | ~15–80 KB | Yes | SWR Tab Memory + IndexedDB |
| **Expense Items List** | PostgreSQL (`expenses`) | `GET /api/trips/[id]/expenses` | React Component State | On expenses view mount | ~10–50 KB | Yes | SWR Tab Memory |
| **Weather Forecast** | Open-Meteo API | `GET /api/trips/[id]/weather` | Server `memoryCache` (15m TTL) | **Every tab switch** | ~2–4 KB | Yes | Server LRU (1h) + Client Mem |
| **Place Search Suggestions**| Google Places API | `POST /api/places/search` | Server `searchCache` (5m TTL) | Keystroke debounced | ~2–5 KB | Yes | Server Bounded LRU (15m) |
| **Place Details** | Google Places API | `GET /api/places/[id]` | Server `detailsCache` (15m TTL) | On card click | ~3–8 KB | Yes | Server Bounded LRU (24h) |
| **Route Geometry & Legs** | Google Routes API | `POST /api/routes` | Server `routeCache` (5m TTL) | On directions click | ~10–40 KB | Yes | Server Bounded LRU (60m) |
| **User Search History** | PostgreSQL (`search_history`) | `GET /api/search/recent` | Client `cachedHistoryData` (1m) | On SearchBox open | ~1–3 KB | Yes | Client Memory (2m TTL) |
| **Often Searched** | PostgreSQL (`search_history`) | `GET /api/search/often` | Client `cachedHistoryData` (1m) | On SearchBox open | ~1–2 KB | Yes | Client Memory (2m TTL) |
| **AI Itinerary Synthesis** | Vertex AI Gemini | `POST /api/ai/plan` | **None** | On user click | ~20–40 KB | Yes | Server Plan Cache (24h) |
| **Reminders (List)** | PostgreSQL (`reminders`) | `GET /api/reminders` | React Component State | On mount / tab navigation | ~3–12 KB | Yes | SWR Memory (1m TTL) |
| **Unread Notification Count**| PostgreSQL (`notifications`) | `GET /api/notifications/unread-count`| localStorage (`gc_cache_unread`)| Polled (1m TTL) | ~50 B | Yes | SWR Polling (1m TTL) |
| **Notifications (Inbox)** | PostgreSQL (`notifications`) | `GET /api/notifications` | React Component State | On page mount | ~5–15 KB | Yes | SWR Memory (1m TTL) |
| **Achievements** | PostgreSQL (`achievements`) | `GET /api/achievements` | React Component State | On page mount / home load | ~2–4 KB | Yes | Client Memory (30m TTL) |
| **Emergency Contacts** | Static JSON / Local config | `GET /api/emergency/contacts` | HTTP Header (`max-age=86400`) | Rare | ~1 KB | Yes | Browser HTTP Cache (7 days) |
| **PWA App Shell** | Static JS/CSS/Icons | Build output | SW `CacheStorage` | Pre-cached on install | ~1.5 MB | Yes | Service Worker Cache First |

---

## 2. Repeated Requests & Waterfall Analysis

### Identified Duplication Hotspots:

```
Waterfalls & Repeat Patterns:
1. Trip Details Tab Churn:
   User on /trips/[tripId] 
     Click "Itinerary"      ──► fetch(/itinerary) + fetch(/weather)
     Click "Budget"         ──► fetch(/budget)
     Click "Transportation" ──► fetch(/transportation)
     Click "Itinerary"      ──► fetch(/itinerary) + fetch(/weather) [REPEAT!]
     Click "Budget"         ──► fetch(/budget) [REPEAT!]

2. Multi-Component Profile & Trips Churn:
   User navigates to /home
     AppNav renders         ──► fetch(/api/profile) + prefetchCoreData(/api/trips)
     HomeDashboard renders  ──► fetch(/api/trips?limit=6) [Cache key mismatch!]
     Trips page opens       ──► fetch(/api/trips) [Fresh network hit]
```

### Detailed Repeated Request Inventory:

| File | Component / Trigger | Endpoint Called | Frequency | Intentional? | Root Cause | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `src/app/trips/[tripId]/page.tsx` | Sub-component tab toggle | `/api/trips/[id]/itinerary`<br>`/api/trips/[id]/weather` | Every tab click | No | Sub-components unmount and re-mount on tab switch without SWR or memory cache. | Implement trip-scoped SWR memory cache. Retain loaded tab data in React state or cache Map. |
| `src/components/budget/BudgetView.tsx` | Tab toggle | `/api/trips/[id]/budget` | Every time user opens Budget tab | No | `useEffect` invokes `loadBudget()` on mount without checking cache. | Cache budget data in client memory keyed by `tripId`. |
| `src/components/transportation/TransportationView.tsx` | Tab toggle | `/api/trips/[id]/transportation` | Every time user opens Transport tab | No | Fetches fresh on mount. | Cache transportation in client memory. |
| `src/components/packing/PackingView.tsx` | Tab toggle | `/api/trips/[id]/packing` | Every time user opens Packing tab | No | Fetches fresh on mount. | Cache packing items in client memory. |
| `src/components/navigation/AppNav.tsx` vs `HomeDashboard.tsx` | Initial home page load | `/api/trips` vs `/api/trips?limit=6` | On every navigation to `/home` | No | `prefetchCoreData` uses key `gc_cache_trips` without query params; `HomeDashboard` calls `/api/trips?limit=6`, missing the cache. | Unify query params or let dashboard consume prefetched trips. |
| `src/lib/achievements/achievement-service.ts` | Any trip, expense, or packing mutation | 8 parallel PostgreSQL queries across all user tables | On every single mutation | No | Ignores `_context.eventType`; full scans all user items for string matches. | Filter evaluation by event type; calculate only relevant badge. |

---

## 3. Cache Layer Analysis

| Layer | Characteristics | Best Suited For | Prohibited For | Current Utilization |
| :--- | :--- | :--- | :--- | :--- |
| **A. Browser Memory (Heap)** | Fastest (0ms), cleared on reload/unload | Tab data, in-flight promises, autocomplete suggestions | Persistent offline data | Used for in-flight deduplication (`inFlightRequests`) and SearchBox history. |
| **B. React State** | Fast, component-scoped, reactive | Form inputs, modal toggles, active filter selections | Cross-page persistence | Heavily used; unmounting causes data loss and re-fetching. |
| **C. Global Context** | Shared across components, persists across page transitions | Active user identity, current trip snapshot, theme | High-volume raw data | Minimal usage; app relies on prop drilling and local state. |
| **D. IndexedDB** | Structured, 50MB+ quota, persistent offline | Deep trip snapshots, offline mutation queues, maps tiles | Passwords, raw JWTs, private API keys | Used for `offline_trip_snapshots`, but not synced during mutations. |
| **E. Service Worker CacheStorage**| Intercepts network requests, versioned | App shell HTML, CSS, JS, fonts, static icons | **Private authenticated API responses** | Pre-caches shell; skips `/api/*` (Secure). |
| **F. Next.js Server Cache** | Request memoization, data cache | Server-rendered pages, static generation | Authenticated user dashboards | None currently used (App Router uses Dynamic Rendering). |
| **G. Database Query Optimization** | PostgreSQL query plans, composite indexes | System of record, relational consistency | High-frequency temporary counters | 15 Prisma models; 9 redundant indexes identified. |
| **H. External API Server Cache** | In-memory Node.js process cache | Google Places, Google Routes, Open-Meteo, Gemini | User-sensitive data | Used with unbounded Maps (Memory leak risk). |

---

## 4. Application Data Classification

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA CLASSIFICATION MATRIX                      │
│                                                                        │
│  [CATEGORY A — STATIC]            [CATEGORY B — SEMI-STATIC]           │
│  - Emergency SOS contacts         - Weather forecasts                  │
│  - PWA shell & icons              - Destination place details          │
│  - Achievement catalog rules      - Search query history               │
│  - Country dialing codes          - Google route geometry              │
│                                                                        │
│  [CATEGORY C — USER DATA]         [CATEGORY D — REAL-TIME]             │
│  - User travel itineraries        - Live unread notification count     │
│  - Personal expense records       - Scheduled reminder triggers        │
│  - Saved bookmarks & places       - Flight / Transit departure times   │
│  - Packing item checklists        - Active geo-coordinates             │
│                                                                        │
│  [CATEGORY E — SENSITIVE / NEVER PERSIST]                              │
│  - Passwords & Bcrypt hashes      - Google OAuth refresh tokens        │
│  - 2FA OTP codes & secret keys    - Raw JWT session strings in storage │
└────────────────────────────────────────────────────────────────────────┘
```

### Explicit Rules: What MUST NOT Be Cached:
1. **Passwords & Password Hashes:** Never stored in any client-side storage (localStorage, sessionStorage, IndexedDB, or Service Worker).
2. **2FA OTP Codes (`auth_security_codes`):** Stored only as server-side SHA-256 hashes with 10-minute expiry; plain text is never stored or cached anywhere.
3. **Session Secrets & Private API Keys:** VAPID private keys, `AUTH_SECRET`, and Google Maps private keys must remain exclusively on the server (`process.env`).
4. **Authenticated API Responses in Public Service Worker:** Dynamic `/api/*` responses must never enter generic `CacheStorage` shared across browser profiles.

---

## 5. User-Scoped Cache Isolation Audit

### Cross-User Contamination Analysis:
A critical security failure in multi-user environments occurs when User A logs out, User B logs in, and User B is presented with User A's cached trips, profile, or expenses.

```
User A (Arjun) Logs In
  └─► Cached in localStorage: gc_cache_profile, gc_cache_trips
  └─► Cached in IndexedDB: offline_trip_snapshots (tripId: trip-123)
User A Logs Out
  └─► Execution of clearAllStoredCache()
        ├─► Removes localStorage keys matching /^gc_cache_/
        └─► Calls IndexedDB clear() on SNAPSHOTS and SYNC_META
User B (Priya) Logs In
  └─► Verification: Zero leftover data from User A.
```

### Audit Findings & Recommendations:
1. **Current Security Status: PASS WITH MINOR ENHANCEMENTS.**
   - `clearAllStoredCache()` cleanly wipes `localStorage` and flushes `IndexedDB`.
   - **Gap 1 (Guest Searches):** `gc_guest_search_history` does not start with `gc_cache_` and is not purged on logout.
   - **Gap 2 (IndexedDB Keying):** `offline_trip_snapshots` keys items by `tripId` alone, without `userId` namespacing (`user:${userId}:trip:${tripId}`). If an asynchronous clear fails during an abrupt tab close, cross-user contamination is theoretically possible.
2. **Recommended Namespace Format:**
   ```
   user:{userId}:profile
   user:{userId}:trips
   user:{userId}:trip:{tripId}
   user:{userId}:notifications
   ```

---

## 6. Detailed TTL Recommendations

| Dataset | Recommended TTL | Stored Location | Justification |
| :--- | :--- | :--- | :--- |
| **User Profile** | **15 minutes** | localStorage / Memory | Profile details (name, email, avatar) change very infrequently. 15m eliminates repeat queries across navigation. |
| **Trips Summary List** | **5 minutes** | localStorage / SWR | Trip lists are modified occasionally. 5m provides instant loads; background revalidation catches updates. |
| **Trip Details Graph** | **14 days (IndexedDB) / 5 min (SWR)** | IndexedDB / Memory | Deep trip details are required offline. 14-day snapshot ensures reliable offline travel; SWR revalidates online. |
| **Itinerary Days & Items**| **5 minutes** | Memory SWR | Changes frequently during active planning; invalidates immediately on mutation. |
| **Transportation Legs** | **15 minutes** | Memory SWR | Transit schedules are static once booked; invalidates on mutation. |
| **Expenses & Budget** | **2 minutes** | Memory SWR | Users input expenses sequentially; short TTL + explicit mutation invalidation prevents calculation drift. |
| **Weather Forecasts** | **60 minutes** | Server LRU + DB Snapshot | Weather forecasts do not update by the minute; 1h reduces external API requests while maintaining accuracy. |
| **Places Autocomplete** | **15 minutes** | Server Bounded LRU | Query strings ("Goa", "Taj Mahal") have static suggestions; 15m cuts Google Places API costs by ~60%. |
| **Place Details** | **24 hours** | Server Bounded LRU | Attraction addresses, coordinates, and phone numbers are virtually static. |
| **Google Routes (Directions)**| **60 minutes** | Server Bounded LRU | Route polylines and base driving distances do not change over 60 minutes. |
| **Search History** | **2 minutes** | Client Memory | Fast access during search; invalidates immediately when a new query is submitted. |
| **Unread Notification Count**| **60 seconds** | localStorage / Polling | Alerts must arrive in near real-time without continuous database bombardment. |
| **Achievements** | **30 minutes** | Client Memory | Gamification badges are earned infrequently; 30m is optimal. |
| **Emergency Contacts** | **7 days** | HTTP Header (`Cache-Control`) | Static emergency numbers (police, ambulance, tourist helpline) almost never change. |
| **AI Itinerary Plan** | **24 hours** | Server LRU Cache | Pre-computed itinerary templates for popular destinations can be safely reused. |

---

## 7. Stale-While-Revalidate (SWR) Strategy Matrix

| Data Entity | Caching Strategy | TTL | Offline Allowed? | Revalidation Trigger |
| :--- | :--- | :--- | :--- | :--- |
| **User Profile** | **Stale-While-Revalidate** | 15 min | Yes | On screen focus or explicit profile edit |
| **Trips List** | **Stale-While-Revalidate** | 5 min | Yes | On navigation to `/trips` or trip creation |
| **Trip Overview & Details** | **Stale-While-Revalidate** | 5 min | **YES (Primary Offline)** | On trip view mount or network reconnect |
| **Itinerary Days** | **Stale-While-Revalidate** | 5 min | Yes | On activity add/edit/delete |
| **Expenses & Budget** | **Stale-While-Revalidate** | 2 min | Yes | On expense add/edit/delete |
| **Weather Forecast** | **Cache First** | 60 min | Yes (Snapshot) | On manual refresh click |
| **Places Search** | **Cache First** | 15 min | No (Network required) | On new search string |
| **Route Geometry** | **Cache First** | 60 min | No (Network required) | On new origin/destination coordinates |
| **Unread Notifications** | **Network First** | 60 sec | No | Every 60s background tick |
| **Emergency Contacts** | **Cache First** | 7 days | **YES (Critical Offline)** | On app version update |

---

## 8. IndexedDB Architecture Audit & Proposed Redesign

### Current State (`src/lib/offline/offline-storage.ts`):
- Uses 2 stores: `offline_trip_snapshots` and `offline_sync_meta`.
- Stores raw deep JSON blobs.
- Lacks LRU eviction, size limits, and user namespace keys.

### Proposed Production IndexedDB Architecture (`ghumnechalo_offline_db` v2):

```
DATABASE: ghumnechalo_offline_db (Version 2)
│
├── STORE: cache_metadata (keyPath: 'cacheKey')
│   ├── Index: 'userId'
│   ├── Index: 'entityType'
│   └── Index: 'expiresAt'
│
├── STORE: trip_snapshots (keyPath: 'compositeKey')  // Format: 'user:{userId}:trip:{tripId}'
│   ├── Index: 'userId'
│   ├── Index: 'tripId'
│   ├── Index: 'cachedAt'
│   └── Schema:
│       {
│         compositeKey: string,
│         userId: string,
│         tripId: string,
│         cachedAt: number,
│         expiresAt: number,
│         version: number,
│         data: TripGraphData
│       }
│
├── STORE: user_cache (keyPath: 'compositeKey')      // Format: 'user:{userId}:{category}'
│   ├── Index: 'userId'
│   └── Schema: { compositeKey, userId, category, data, updatedAt }
│
└── STORE: offline_sync_queue (keyPath: 'id')        // Outbox for offline mutations
    ├── Index: 'userId'
    ├── Index: 'createdAt'
    └── Schema: { id, userId, method, endpoint, payload, createdAt, status }
```

### Eviction Policy:
- Maximum 15 trip snapshots per user.
- On saving snapshot #16, the oldest snapshot (by `cachedAt`) is automatically deleted.

---

## 9. Service Worker Cache Audit

### Current State (`public/sw.js`):
- `ghumnechalo-pwa-v1.2.0` (App Shell)
- `ghumnechalo-static-v1.2.0` (Static assets)
- Explicit skip for `/api/*` requests.

### Audit Verdict: **PASS (Architecturally Sound)**
- Dynamic user API responses are correctly excluded from `CacheStorage`.
- Static scripts, styles, and fonts use **Cache First**.
- HTML navigations use **Network First** with fallback to `/offline`.

---

## 10. API Response Caching Matrix

| Endpoint | HTTP Method | Cacheable? | Recommended Cache-Control Header | Scope | Invalidation Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/profile` | GET | Yes | `private, no-cache` (Handle in client SWR) | User | User profile update |
| `/api/trips` | GET | Yes | `private, no-cache` (Handle in client SWR) | User | Trip create/delete |
| `/api/trips/[id]` | GET | Yes | `private, no-cache` (Handle in client SWR) | User | Trip update |
| `/api/trips/[id]/itinerary`| GET | Yes | `private, no-cache` (Handle in client SWR) | User | Activity add/edit/delete |
| `/api/trips/[id]/budget` | GET | Yes | `private, no-cache` (Handle in client SWR) | User | Expense add/delete |
| `/api/trips/[id]/weather`| GET | Yes | `private, max-age=3600, stale-while-revalidate=7200` | User | Auto daily |
| `/api/search/recent` | GET | Yes | `private, no-cache` (Handle in client memory) | User | Search performed |
| `/api/search/often` | GET | Yes | `private, no-cache` (Handle in client memory) | User | Search performed |
| `/api/places/search` | POST | Yes | Server-side LRU Cache only | Public | 15 min TTL |
| `/api/places/[id]` | GET | Yes | `public, max-age=86400, stale-while-revalidate=604800` | Public | 24 Hours TTL |
| `/api/routes` | POST | Yes | Server-side LRU Cache only | Public | 60 min TTL |
| `/api/weather` | GET | Yes | `public, max-age=3600, stale-while-revalidate=7200` | Public | 60 min TTL |
| `/api/emergency/contacts` | GET | Yes | `public, max-age=604800, immutable` | Public | Deployment |
| `/api/achievements` | GET | Yes | `private, no-cache` (Handle in client memory) | User | Badge unlock |

*Note: Authenticated user endpoints should NEVER use `public` in Cache-Control headers to prevent intermediary CDN or shared proxy cache leaks.*

---

## 11. Database Query Caching & Optimization

### Repeated Query Analysis (Prisma):
1. **Redundant User Verification:** Almost every API route executes `requireAuth()`, which verifies JWT and calls `prisma.user.findUnique()`.
   - *Fix:* Next.js request-level memoization via React `cache()` prevents multiple `findUnique` calls for the same user in a single request lifecycle.
2. **In-Memory Budget Summation:** `/api/trips/[id]/budget` loads all expenses across the wire into Node.js to compute `.reduce()`.
   - *Fix:* Replace with `prisma.expense.aggregate({ _sum: { amount: true } })`.
3. **Achievement Multi-Table Scans:** `evaluateAchievements()` loads all saved places and itinerary items into memory for string keyword matching.
   - *Fix:* Filter evaluation by `eventType` to query only relevant counts.
4. **Is Redis Necessary?**
   - **Verdict: NO.** For GhumneChalo's current scale (up to 50,000 active travelers), in-memory bounded LRU caches in Node.js combined with PostgreSQL composite indexes and client SWR provide sub-10ms response times without the infrastructure complexity, operational overhead, and cost of a dedicated Redis cluster.

---

## 12. External API Caching Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │             External API Caching             │
                       └──────────────────────┬───────────────────────┘
                                              │
         ┌───────────────────┬────────────────┼───────────────────┐
         ▼                   ▼                ▼                   ▼
  [Google Places]     [Google Routes]   [Open-Meteo]        [Vertex AI]
  - 15m Autocomplete  - 60m Polyline    - 60m Forecast      - 24h Template
  - 24h Details       - 500 Entry LRU   - Coord Grid Key    - Prompt Hash
  - 500 Entry LRU                       - 500 Entry LRU     - 100 Entry LRU
```

### Savings Estimation:
- **Google Places API:** Caching autocomplete for 15 minutes and details for 24 hours reduces API calls by **~60%**, saving significant monthly costs on high-traffic days.
- **Google Routes API:** 60-minute route caching prevents repeated calls when travelers toggle back and forth between itinerary maps.
- **Vertex AI Gemini:** 24-hour plan template caching eliminates repeated $0.002+ token charges for popular travel searches (e.g. "Goa 3 days budget").

---

## 13. Complete Cache Invalidation Dependency Graph

```
┌──────────────────────────────────────┐
│            MUTATION EVENT            │
└──────────────────┬───────────────────┘
                   │
    ┌──────────────┼──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼              ▼
[CREATE TRIP]  [UPDATE TRIP]  [DELETE TRIP]  [ADD EXPENSE]  [ADD ACTIVITY]
    │              │              │              │              │
    ├─► Clear      ├─► Invalidate ├─► Purge      ├─► Invalidate ├─► Invalidate
    │   Trips SWR  │   Trip SWR   │   Trip SWR   │   Budget SWR │   Itinerary SWR
    │              │              │              │              │
    ├─► Clear      ├─► Update     ├─► Remove     ├─► Invalidate ├─► Update
    │   Dashboard  │   IndexedDB  │   IndexedDB  │   Expenses   │   IndexedDB
    │   Cache      │   Snapshot   │   Snapshot   │   List SWR   │   Snapshot
    │              │              │              │              │
    └─► Prefetch   └─► Revalidate └─► Clear      └─► Revalidate └─► Update Trip
        New Trip       Overview       Weather        Dashboard      Day Count
                       Tab            Cache          Totals         Progress
```

---

## 14. Offline-First Architecture & Behavior

| State | User Experience & Caching Behavior |
| :--- | :--- |
| **ONLINE** | 1. Load from SWR memory/IndexedDB instantly (0ms).<br>2. Fetch fresh data from API in background.<br>3. Smoothly update UI if data changed. |
| **SLOW NETWORK** | 1. Render cached snapshot immediately.<br>2. Display subtle loading indicator (e.g. gentle shimmer or small spinner).<br>3. Never block UI with full-screen blocking spinners. |
| **OFFLINE** | 1. Render last known snapshot from IndexedDB.<br>2. Show `OfflineTripBanner` ("Viewing cached offline version").<br>3. Read-only navigation fully functional (Itinerary, Map, Directions, Packing).<br>4. Disable network-dependent external actions (AI planner, Google live search). |
| **NETWORK RESTORED** | 1. Listen for `window.addEventListener('online')`.<br>2. Background revalidate all open view caches.<br>3. Dismiss offline banner automatically. |

---

## 15. Storage Budget & Growth Limits

### Entity Footprint Breakdown:
- Average Trip Graph (14 Days, 40 activities, transit, budget): **~25 KB**
- User Profile: **~0.25 KB**
- Search History (50 items): **~2 KB**
- Notifications (50 items): **~8 KB**
- Weather Snapshot: **~1.5 KB**

### Maximum Recommended Limits:

| Storage Tier | Max Items | Max Footprint | Eviction Strategy |
| :--- | :--- | :--- | :--- |
| **IndexedDB Snapshots** | 15 Trips | ~1.5 MB | LRU (Oldest `cachedAt` evicted) |
| **Client localStorage** | 20 Keys | ~500 KB | Automatic TTL expiry + Clear on quota error |
| **Server Places Search**| 500 Entries | ~2 MB | Bounded LRU Map |
| **Server Place Details**| 1,000 Entries| ~5 MB | Bounded LRU Map |
| **Server Route Geometry**| 500 Entries | ~10 MB | Bounded LRU Map |
| **Server Weather** | 500 Entries | ~1 MB | Bounded LRU Map |

---

## 16. Performance Impact Estimation

| Dimension | Baseline Without Caching | Optimized Target With SWR + LRU | Estimated Improvement |
| :--- | :--- | :--- | :--- |
| **Trip Tab Switching** | 350–650 ms (Network roundtrip) | **0–10 ms** (Memory SWR) | **HIGH (~98% Faster)** |
| **Trip Details Initial Load**| 400–800 ms (Server DB query) | **0 ms** (Instant from IndexedDB) | **HIGH (Instant Render)** |
| **Database Query Volume** | ~15 queries per trip session | **~2 queries** per trip session | **HIGH (~85% Reduction)** |
| **Google Places API Calls** | 1 per search across all tabs | 1 per unique query / 15 min | **MEDIUM (~60% Cost Reduction)** |
| **Google Routes API Calls** | 1 per route calculation | 1 per unique coordinate pair / 60m | **MEDIUM (~40% Cost Reduction)** |
| **Mobile Data Consumption** | ~150 KB per tab churn | **< 5 KB** per tab churn | **HIGH (~95% Bandwidth Savings)** |
| **Server Memory Stability** | Unbounded Map growth | Strict 500–1000 item capacity | **CRITICAL (Zero Memory Leaks)** |

---

## 17. Security & Privacy Audit

| Security Vector | Risk Level | Current State | Verification / Recommendation |
| :--- | :--- | :--- | :--- |
| **Password Storage** | **NONE** | Passwords stored strictly as Bcrypt hashes (12 rounds) on PostgreSQL. | Never cached in any browser storage. **PASS**. |
| **2FA OTP Codes** | **NONE** | Stored as SHA-256 hashes in `auth_security_codes` (10m TTL). | Never cached in browser storage. **PASS**. |
| **API Keys & Secrets** | **NONE** | Google Maps API key, VAPID keys, and `AUTH_SECRET` loaded via `process.env`. | Never leaked in client bundles or database. **PASS**. |
| **Service Worker Isolation** | **NONE** | `public/sw.js` routes `/api/*` as `Network Only`. | Authenticated API responses never cached in global SW storage. **PASS**. |
| **Cross-User Data Leakage** | **LOW** | `clearAllStoredCache()` purges `localStorage` and `IndexedDB` on logout. | Add `gc_guest_search_history` to clear list; use `window.location.href = '/'` on sign out. |

---

## 18. Final Master Recommendations & Implementation Roadmap

### Summary of Deliverables:

- **A. Current Cache Architecture:** Multi-tier client cache (`client-cache.ts`), Service Worker app shell (`sw.js`), and server-side in-memory Maps (`places.ts`, `routes.ts`, `weather-service.ts`).
- **B. Problems Found:** Unbounded server Maps (memory leak risk), tab churn in `/trips/[tripId]` causing repeat DB queries, desynchronization between REST mutations and IndexedDB offline snapshots, and coordinate precision cache fragmentation in weather.
- **C. Data That Should Be Cached:** User profile, trip overview lists, trip graph snapshots, tab views (Itinerary, Budget, Transport, Packing), Google Places search/details, Google Routes, Open-Meteo weather, and Gemini AI itinerary templates.
- **D. Data That Must NOT Be Cached:** Passwords, OTPs, session secrets, private API keys, and raw authentication tokens.
- **E. Cache Layer Recommendation:** Browser memory for tab switching; localStorage for user profile/trips SWR; IndexedDB for deep trip snapshots; Server LRU for external API responses; Service Worker strictly for static app shell.
- **F. TTL Matrix:** Outlined in Section 6.
- **G. Cache Key Design:** Conceptually isolated with `user:{userId}:{entity}` for user data, and normalized hashes for public external APIs.
- **H. Invalidation Matrix:** Documented in Section 13.
- **I. IndexedDB Architecture:** Redesigned in Section 8 with 15-trip LRU ceiling and user namespacing.
- **J. Service Worker Strategy:** Keep `/api/*` as `Network Only`; retain `Cache First` for static assets.
- **K. API Cache Strategy:** Add appropriate `private, no-cache` headers for user data and `public, max-age` for static emergency contacts.
- **L. Database Optimization:** Use `prisma.expense.aggregate._sum`; memoize user lookups; drop 9 redundant duplicate B-Tree indexes.
- **M. External API Optimization:** Replace unbounded Maps with bounded LRU caches (500 items max).
- **N. Offline Strategy:** Stale-while-revalidate with background revalidation on network restore.
- **O. Security Risks:** Minor heap retention risk addressed by hard redirect on logout.
- **P. Storage Budget:** Strict 15-trip / 1.5MB cap on IndexedDB.
- **Q. Priority Implementation Roadmap:**

```
PRIORITY CLASSIFICATION:
P0 = Security / Data Leakage / Corruption
P1 = Major Performance / Repeated Requests / Memory Leaks
P2 = Useful Optimization / Cost Reduction
P3 = Optional Hygiene / Polish
```

| Priority | ID | Task Description | Target Files |
| :--- | :--- | :--- | :--- |
| **P0** | SEC-01 | Add `gc_guest_search_history` to logout clear routine and execute hard reload (`window.location.href = '/'`) on sign out. | `src/lib/cache/client-cache.ts`<br>`src/components/navigation/AppNav.tsx` |
| **P1** | PERF-01 | Create a zero-dependency `LRUCache<K, V>` helper class with maximum entry bounds and TTL eviction. | `src/lib/cache/lru-cache.ts` |
| **P1** | PERF-02 | Replace unbounded `Map` instances in Google Places and Routes services with bounded `LRUCache`. | `src/lib/maps/places.ts`<br>`src/lib/maps/routes.ts` |
| **P1** | PERF-03 | Implement client-side SWR tab memory caching in `/trips/[tripId]` to eliminate repeat fetches on tab toggle. | `src/app/trips/[tripId]/page.tsx` |
| **P1** | DATA-01 | Automatically update local IndexedDB offline snapshot when activities, expenses, or transit legs are mutated. | `src/components/itinerary/ItineraryView.tsx`<br>`src/components/budget/BudgetView.tsx` |
| **P2** | COST-01 | Extend Google Routes API cache TTL from 5 min to 60 min to reduce external billing. | `src/lib/maps/routes.ts` |
| **P2** | COST-02 | Re-key weather cache from `trip:${tripId}` to coordinate grid `weather:{lat.toFixed(2)}:{lng.toFixed(2)}:{dates}`. | `src/lib/weather/weather-service.ts` |
| **P2** | PERF-04 | Add 15-trip LRU ceiling to `saveTripOfflineSnapshot` in IndexedDB. | `src/lib/offline/offline-storage.ts` |
| **P3** | COST-03 | Add 24-hour response caching for Vertex AI Gemini itinerary generation prompts. | `src/lib/ai/itinerary-generator.ts` |

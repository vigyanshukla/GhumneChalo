# GhumneChalo — Project Overview & Architecture Reference

> **Token Saver Reference Document**: This document outlines the core architecture, key components, offline caching mechanisms, and recent fixes to eliminate repetitive file reading and preserve context.

---

## 1. Project Tech Stack & Conventions
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Lucide React icons, Glassmorphism & dark-mode support
- **Database / ORM**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`)
- **Validation**: Zod schemas (`src/lib/validation.ts`)
- **Authentication**: Custom session-based auth with argon2 password hashing + Google OAuth (`src/lib/auth-service.ts`, `src/lib/auth-oauth.ts`, `src/lib/auth-client.ts`)
- **PWA & Offline**: Custom Service Worker (`public/sw.js`), IndexedDB (`idb` wrapper in `src/lib/offline/offline-storage.ts`), LocalStorage Stale-While-Revalidate (`src/lib/cache/client-cache.ts`)

---

## 2. Offline & Caching Architecture

### A. Tri-Tier Storage System
1. **Tier 1: In-Memory / Tab Cache (`client-cache.ts`)**
   - In-memory `Map` with fast eviction (LRU up to 50 entries).
   - Prevents duplicate fetch requests on tab switching or rapid UI interactions.
2. **Tier 2: LocalStorage SWR Cache (`client-cache.ts`)**
   - Helper functions: `getStoredItem<T>(key)`, `setStoredItem<T>(key, data, ttlMs)`.
   - Used for quick UI rendering, search query caching, place details, and guest search history.
3. **Tier 3: IndexedDB Snapshot Store (`offline-storage.ts`)**
   - Database: `ghumnechalo_offline_db` (version 2)
   - Store: `trip_snapshots` (keyed by `tripId` with index on `userId`)
   - Stores full trip object + nested sections: `itinerary`, `transportation`, `weather`, `budget`, `packing`.
   - Max snapshots per user: 20 (auto-cleaned via `cleanupOldSnapshots`).

### B. Service Worker (`public/sw.js`)
- Pre-caches core app assets: `/home`, `/trips`, `/explore`, `/manifest.json`, icons.
- Avoids caching redirecting `/` to avoid 307 redirect cache poisoning.
- Stale-While-Revalidate for app routes and static assets.
- Provides fallback offline HTML shell if network is completely unavailable.

---

## 3. Search & Place Caching (Offline Support)

### Search Flow (`SearchBox.tsx`, `PlaceDetailsCard.tsx`, `/explore`)
- **Debounced API**: Calls `/api/places/search?q=...&limit=8`.
- **Query Cache (`client-cache.ts`)**:
  - Key: `gc_search_${query.toLowerCase().trim()}`
  - Saves query results on successful network fetch.
  - When offline or fetch fails, retrieves cached results from local storage and displays results seamlessly.
- **Recent Searches**:
  - Stored in server (`/api/search/recent`) for logged-in users, and mirrored in `localStorage` (`ghumnechalo_guest_recent_searches`).
  - Available immediately offline when focusing search input.
- **Place Details Caching (`PlaceDetailsCard.tsx`)**:
  - Key: `gc_place_${placeId}`
  - Caches place details (address, contact, opening hours, photos, ratings).
  - On offline mode, instantly displays cached details without failing.
- **Coordinate Weather for Places**:
  - Key: `gc_weather_coord_${lat}_${lng}`
  - When a place is searched or viewed, weather is cached so users can inspect conditions offline.

---

## 4. Trips & Plan Offline Support

### Trip Detail Page (`src/app/trips/[tripId]/page.tsx`)
- Reads snapshot from IndexedDB first for instant 0ms load.
- Revalidates with `/api/trips/[tripId]` when online, then updates IndexedDB.
- Sub-components with offline resilience:
  1. **ItineraryView**: Reads from snapshot / `gc_cache_itinerary_${tripId}`; supports offline edits queued in IndexedDB.
  2. **TransportationView**: Reads from snapshot / `gc_cache_transportation_${tripId}`; supports offline booking notes.
  3. **WeatherView**: Reads from snapshot / `gc_cache_weather_${tripId}`; persists forecasts locally.
  4. **BudgetView**: Reads from snapshot / `gc_cache_budget_${tripId}`; offline expense tracking.
  5. **PackingView**: Reads from snapshot / `gc_cache_packing_${tripId}`; offline checklist toggle.
- **Trip Plan Creation (`TripForm.tsx` & `AiPlannerModal.tsx`)**:
  - On saving/creating a trip plan, the complete trip and its initial weather/itinerary are automatically persisted to IndexedDB so it's instantly available offline.

---

## 5. Key APIs & Route Handlers
| Route | Method | Purpose | Offline Behavior |
|---|---|---|---|
| `/api/places/search` | GET | Destination/place search | Falls back to cached queries |
| `/api/places/[placeId]` | GET | Place details & metadata | Falls back to `gc_place_${id}` |
| `/api/weather` | GET | Coordinate weather lookup | Falls back to `gc_weather_coord_*` |
| `/api/trips` | GET, POST | List & create trips | Stored in IndexedDB |
| `/api/trips/[tripId]` | GET, PUT, DELETE | Trip details & updates | IndexedDB snapshot |
| `/api/trips/[tripId]/weather` | GET | Trip date-bounded weather | Stored in trip snapshot & SWR |
| `/api/search/recent` | GET, POST, DELETE | Search history sync | Stored in localStorage |

---

## 6. Recent Glitch Fixes (Summary)
1. **Google Account Binding**:
   - `SecuritySettingsClient.tsx` uses form POST to `/api/auth/signin/google` with `redirectTo`.
   - `src/lib/auth-oauth.ts` checks `auth_session` cookie to link Google account to current user instead of creating duplicate accounts.
2. **Profile Name Update Error**:
   - `profileUpdateSchema` in `src/lib/validation.ts` accepts empty string or null for `image`, converting to `null` to prevent "Invalid image URL" Zod error.
   - Dispatches `ghumnechalo:profile-updated` event to sync `AppNav` in real-time.
3. **Mobile Logout Refresh**:
   - `src/proxy.ts` bypasses `/home` redirection when `?logged_out=1` is present.
   - `/api/auth/logout/route.ts` directly supports 303 redirect.
   - IndexedDB logout purge has timeout safeguards to avoid hanging mobile WebViews.
4. **PWA Precache & Vercel Offline Handling**:
   - Upgraded Service Worker to v1.4.0 in `public/sw.js`.
   - Intercepts Next.js App Router RSC payloads (`?_rsc=...` & `RSC: 1` headers) so client-side navigation never fails with a Vercel 500 error when offline.
   - Added 3.5s timeout with `AbortController` to navigation requests with multi-tier fallback to cached pages, `/offline`, and a self-contained offline HTML shell.
   - Registered Service Worker immediately on mount in `PWARegistration.tsx`.
5. **Code Hygiene & Zero Warnings**:
   - All ESLint errors and warnings resolved (clean exit code 0).
   - Production build verified with zero errors (all 57 routes compiled cleanly).

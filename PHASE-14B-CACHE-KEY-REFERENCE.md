# PHASE 14B — CACHE KEY & STORAGE REFERENCE
## GhumneChalo — Smart Wander Platform

This document is the authoritative reference for all cache keys, storage formats, scopes, lifetimes, and invalidation rules across the client and server architecture.

---

## 1. Summary of Cache Layers

| Layer | Implementation | Scope | Storage Medium | Eviction Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Server Memory** | `ServerLRUCache<K, V>` | Process / Node.js heap | In-memory doubly linked list + Map | LRU eviction on `maxSize` + proactive TTL cleanup |
| **Client Memory** | `memoryTabCache` | Browser session / tab | JavaScript Map | LRU eviction on 50 entries + logout purge |
| **Client LocalStorage** | `getStoredItem` / `setStoredItem` | Browser origin / user | `window.localStorage` | Explicit TTL check + logout wipe |
| **Client IndexedDB** | `ghumnechalo_offline_db` | Device persistent storage | IndexedDB `offline_trip_snapshots` | User-scoped LRU cleanup + logout purge |

---

## 2. Server-Side Cache Keys (`ServerLRUCache`)

### 2.1 Google Places Search Cache
- **Key Format**: `${sanitizedQuery.toLowerCase()}::${limit}`
- **Example**: `jaipur forts::8`
- **Purpose**: Caches sanitized text search results from Google Places API (New).
- **Scope**: Global (public geographic data).
- **Privacy**: **Public** (no PII or user identity).
- **Max Entries**: 200
- **TTL**: 5 minutes (`300,000 ms`).
- **Invalidation Trigger**: Natural TTL expiry or manual `searchCache.clear()`.
- **Deduplication**: In-flight promise map `inFlightSearches`.

### 2.2 Google Places Details Cache
- **Key Format**: `${placeId}`
- **Example**: `ChIJG8...7bA`
- **Purpose**: Caches structured place details (opening hours, rating, phone, address).
- **Scope**: Global (public venue details).
- **Privacy**: **Public**.
- **Max Entries**: 500
- **TTL**: 60 minutes (`3,600,000 ms`).
- **Invalidation Trigger**: Natural TTL expiry or manual `detailsCache.clear()`.
- **Deduplication**: In-flight promise map `inFlightDetails`.

### 2.3 Google Places Discovery / Category Cache
- **Key Format**: `${category}::${latitude.toFixed(3)},${longitude.toFixed(3)}::${radiusMeters}`
- **Example**: `attractions::26.912,75.787::5000`
- **Purpose**: Caches nearby places discovered by category and coordinate center.
- **Scope**: Global.
- **Privacy**: **Public**.
- **Max Entries**: 200
- **TTL**: 5 minutes (`300,000 ms`).
- **Invalidation Trigger**: Natural TTL expiry.

### 2.4 Google Routes Compute Cache
- **Key Format**: `route:${originLat.toFixed(4)},${originLng.toFixed(4)}->${destLat.toFixed(4)},${destLng.toFixed(4)}:${travelMode}`
- **Example**: `route:26.9124,75.7873->26.9855,75.8507:DRIVE`
- **Purpose**: Caches computed route polylines, duration, distance, and warnings.
- **Scope**: Global (fixed geographic coordinates).
- **Privacy**: **Public** (normalized coordinates only; no user IDs).
- **Max Entries**: 100 (~1.5 MB max heap).
- **TTL**: 60 minutes (`3,600,000 ms`).
- **Invalidation Trigger**: Natural TTL expiry or `_clearRouteCache()`.
- **Deduplication**: In-flight promise map `inFlightRoutes`.

### 2.5 Trip Weather In-Memory Cache
- **Key Format**: `trip:${tripId}`
- **Example**: `trip:cm2b8f10j0001abcde`
- **Purpose**: Caches multi-day weather forecasts and normalized conditions for a trip.
- **Scope**: Per-trip (ownership verified before retrieval).
- **Privacy**: **Private / Authenticated** (requires trip ownership validation).
- **Max Entries**: 100
- **TTL**: 15 minutes (`900,000 ms`).
- **Invalidation Trigger**: `forceRefresh=true` query parameter, or trip date changes.

### 2.6 Coordinate Weather Cache
- **Key Format**: `${latitude.toFixed(2)}:${longitude.toFixed(2)}:${startDate}:${endDate}`
- **Example**: `26.91:75.79:2026-10-02:2026-10-09`
- **Purpose**: Caches standalone coordinate forecast lookups for explore views.
- **Scope**: Global.
- **Privacy**: **Public**.
- **Max Entries**: 100
- **TTL**: 15 minutes (`900,000 ms`).
- **Invalidation Trigger**: Natural TTL expiry.

### 2.7 AI Plan Generation Cache
- **Key Format**: `user:${userId}:trip:${tripId}:model:${modelVersion}:${destination}:${startDate}:${endDate}:${sortedPreferencesJson}`
- **Example**: `user:usr_1:trip:trp_1:model:v1:Goa:2026-11-01:2026-11-05:{"budget":25000,"travelStyle":"relaxed"}`
- **Purpose**: Caches generated AI itinerary plan previews to prevent duplicate Gemini invocations.
- **Scope**: **Strictly User-Scoped + Trip-Scoped**.
- **Privacy**: **Strictly Private** (never returned to another user).
- **Max Entries**: 50
- **TTL**: 15 minutes (`900,000 ms`).
- **Invalidation Trigger**: `forceRefresh=true` parameter or modification of trip dates/budget.
- **Deduplication**: In-flight promise map `inFlightAiRequests`.

---

## 3. Client-Side Cache Keys (`localStorage` & Memory)

### 3.1 Trip-Scoped Memory Tab Cache
- **Key Format**: `user:${userId}:trip:${tripId}:${tabName}`
- **Examples**:
  - `user:usr_1:trip:trp_1:overview`
  - `user:usr_1:trip:trp_1:itinerary`
  - `user:usr_1:trip:trp_1:transportation`
  - `user:usr_1:trip:trp_1:weather`
  - `user:usr_1:trip:trp_1:budget`
  - `user:usr_1:trip:trp_1:packing`
- **Purpose**: Keeps tab state cached in memory during active navigation so tab switches are instantaneous (0ms).
- **Scope**: User + Trip scoped.
- **Privacy**: **Private**.
- **Max Entries**: 50
- **TTL**: 5 minutes (`300,000 ms`).
- **Invalidation Trigger**: `invalidateTripTabData(userId, tripId, tab)` on mutation, or `clearMemoryTabCache()` on logout.

### 3.2 User Profile Cache (`localStorage`)
- **Key**: `gc_cache_profile`
- **Purpose**: Provides instant user avatar, name, and email rendering in navigation headers.
- **Privacy**: **Private**.
- **TTL**: 10 minutes.
- **Invalidation Trigger**: Profile edit submission or logout.

### 3.3 Trips Preview Cache (`localStorage`)
- **Key**: `gc_cache_trips`
- **Purpose**: Provides instant rendering of the user's trip list on Home and Trips dashboards.
- **Privacy**: **Private**.
- **TTL**: 5 minutes.
- **Invalidation Trigger**: Trip creation, update, deletion, archive, or logout.

### 3.4 Unread Notifications Count Cache (`localStorage`)
- **Key**: `gc_cache_notifications_unread`
- **Purpose**: Prevents repeated polling of notification count on every page navigation.
- **Privacy**: **Private**.
- **TTL**: 60 seconds.
- **Invalidation Trigger**: Marking notifications as read or clicking notification bell.

### 3.5 Client Trip Weather Cache (`localStorage`)
- **Key Format**: `gc_cache_weather_${tripId}`
- **Example**: `gc_cache_weather_cm2b8f10j0001`
- **Purpose**: Displays last known forecast immediately when opening the Weather tab.
- **Privacy**: **Private**.
- **TTL**: 15 minutes.
- **Invalidation Trigger**: Manual click on "Refresh" or trip date update.

---

## 4. IndexedDB Storage Schema (`ghumnechalo_offline_db`)

### 4.1 `offline_trip_snapshots` Store
- **Key Path**: `storageKey`
- **Key Format**: `user:${userId}:trip:${tripId}`
- **Indexes**:
  - `userId` (for multi-tenant filtering and targeted user purge)
  - `tripId` (for fast trip lookup)
  - `cachedAt` (for LRU quota cleanup)
- **Stored Payload**:
  ```ts
  interface OfflineTripSnapshot {
    storageKey: string;     // "user:usr_1:trip:trp_1"
    tripId: string;
    userId: string;
    cachedAt: number;
    version: number;        // schema version (2)
    trip: TripSummary;
    itinerary?: unknown[];
    transportation?: unknown[];
    weather?: NormalizedTripWeather;
  }
  ```
- **Privacy**: **Strictly Private**.
- **Quota Limit**: Maximum 20 snapshots per user. Oldest snapshots evicted via `cleanupOldSnapshots(userId)`.
- **Invalidation Trigger**: Trip deletion or `clearUserOfflineStorage(userId)` on sign out.

### 4.2 `offline_sync_meta` Store
- **Key Path**: `key`
- **Purpose**: Tracks synchronization milestones and last online sync timestamps.
- **Privacy**: Non-sensitive operational metadata.
- **Invalidation Trigger**: Logout or service worker update.

---

## 5. Security & Isolation Invariants

1. **Zero Cross-User Leakage**:
   - Every private cache key begins with `user:${userId}:`.
   - IndexedDB lookups require matching `userId`.
   - On logout, `clearAllStoredCache()` unconditionally executes:
     - All `gc_cache_*` and `gc_guest_*` keys removed from `localStorage`.
     - In-memory `memoryTabCache` cleared.
     - IndexedDB stores wiped for the active user.
     - Hard redirect (`window.location.href = '/'`) purges all React heap state.
2. **Zero Sensitive Data Persistence**:
   - Passwords, password hashes, auth tokens, session secrets, and 2FA codes are **NEVER** cached in `localStorage`, `IndexedDB`, or memory caches.

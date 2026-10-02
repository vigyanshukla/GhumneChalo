/**
 * GhumneChalo Client-side Storage & Fetch Optimization Cache
 *
 * Implements:
 * 1. Fast localStorage caching with configurable TTL (Stale-While-Revalidate).
 * 2. In-flight request deduplication (prevents multiple parallel identical fetch calls).
 * 3. Instant UI render from local storage (0ms latency).
 * 4. Automatic cache invalidation on mutations and clean logout purge.
 * 5. Trip-scoped in-memory tab cache (prevents re-fetches on tab switches).
 * 6. User-scoped memory cache with cleanup on logout.
 */

import { clearAllOfflineStorage } from '@/lib/offline/offline-storage';

export const CACHE_KEYS = {
  PROFILE: 'gc_cache_profile',
  TRIPS: 'gc_cache_trips',
  NOTIFICATIONS_UNREAD: 'gc_cache_notifications_unread',
  SECURITY: 'gc_cache_security',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS] | string;

interface CachePayload<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes default cache
const inFlightRequests = new Map<string, Promise<unknown>>();

// ─── Trip-Scoped In-Memory Tab Cache ────────────────────────────────────────
// Keyed as "user:{userId}:trip:{tripId}:{tab}"
// This prevents re-fetches when switching between trip tabs.
// Cleared on logout / account switch.

interface MemoryCacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
}

const memoryTabCache = new Map<string, MemoryCacheEntry<unknown>>();
const MEMORY_TAB_CACHE_MAX = 50; // max entries to prevent unbounded growth

/** Build a user+trip scoped cache key for tab data. */
export function buildTripTabCacheKey(
  userId: string,
  tripId: string,
  tab: string
): string {
  return `user:${userId}:trip:${tripId}:${tab}`;
}

/** Check if a memory tab cache entry is fresh. */
function isMemoryEntryFresh<T>(entry: MemoryCacheEntry<T>): boolean {
  return Date.now() - entry.fetchedAt < entry.ttlMs;
}

/**
 * Get from in-memory tab cache.
 * Returns { data, isStale } or null if not cached.
 */
export function getMemoryTabData<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = memoryTabCache.get(key) as MemoryCacheEntry<T> | undefined;
  if (!entry) return null;
  return {
    data: entry.data,
    isStale: !isMemoryEntryFresh(entry),
  };
}

/**
 * Store in the in-memory tab cache.
 * Enforces max size by evicting the oldest entry on overflow.
 */
export function setMemoryTabData<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  // Evict oldest entry if at capacity
  if (memoryTabCache.size >= MEMORY_TAB_CACHE_MAX && !memoryTabCache.has(key)) {
    const firstKey = memoryTabCache.keys().next().value;
    if (firstKey !== undefined) memoryTabCache.delete(firstKey);
  }
  memoryTabCache.set(key, { data, fetchedAt: Date.now(), ttlMs });
}

/**
 * Invalidate specific trip tab data from the in-memory cache.
 */
export function invalidateTripTabData(userId: string, tripId: string, tab?: string): void {
  if (tab) {
    memoryTabCache.delete(buildTripTabCacheKey(userId, tripId, tab));
  } else {
    // Invalidate all tabs for this trip
    const prefix = `user:${userId}:trip:${tripId}:`;
    for (const key of memoryTabCache.keys()) {
      if (key.startsWith(prefix)) memoryTabCache.delete(key);
    }
  }
}

/**
 * Clear all in-memory tab cache entries (on logout / account switch).
 */
export function clearMemoryTabCache(): void {
  memoryTabCache.clear();
}

// ─── localStorage Helpers ────────────────────────────────────────────────────

/**
 * Safely retrieve an item from localStorage
 */
export function getStoredItem<T>(key: string): { data: T; isStale: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const payload = JSON.parse(raw) as CachePayload<T>;
    if (!payload || typeof payload.timestamp !== 'number') {
      return null;
    }

    const age = Date.now() - payload.timestamp;
    const isStale = age > (payload.ttlMs || DEFAULT_TTL_MS);

    return {
      data: payload.data,
      isStale,
    };
  } catch {
    return null;
  }
}

/**
 * Safely save an item to localStorage with timestamp and TTL
 */
export function setStoredItem<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachePayload<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    // If quota exceeded or storage disabled, silently ignore or clear older items
    console.warn('[ClientCache] Failed to write localStorage key:', key, err);
  }
}

/**
 * Remove a specific key from localStorage
 */
export function removeStoredItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Clear all application cache from localStorage, sessionStorage, and IndexedDB (e.g. on logout).
 * Also clears in-memory tab cache and CacheStorage.
 */
export function clearAllStoredCache(): void {
  if (typeof window === 'undefined') return;

  // 1. Clear all localStorage
  try {
    localStorage.clear();
  } catch {}

  // 2. Clear all sessionStorage
  try {
    sessionStorage.clear();
  } catch {}

  // 3. Clear in-memory tab cache
  clearMemoryTabCache();

  // 4. Purge IndexedDB
  clearAllOfflineStorage().catch(() => {});

  // 5. Purge CacheStorage (PWA / Service Worker)
  try {
    if ('caches' in window) {
      window.caches.keys().then((keys) => {
        keys.forEach((key) => window.caches.delete(key));
      }).catch(() => {});
    }
  } catch {}
}

export interface CachedFetchOptions {
  cacheKey?: string;
  ttlMs?: number;
  forceRefresh?: boolean;
}

/**
 * Optimized fetch wrapper with true Stale-While-Revalidate (SWR):
 * - Checks localStorage first: returns cached data instantly (0ms latency).
 * - If stale, returns cached data immediately while revalidating in background.
 * - Deduplicates identical in-flight requests.
 * - Has an 8-second timeout so requests never freeze or hang the mobile UI.
 * - Updates localStorage once network response succeeds.
 */
export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  cacheOptions?: CachedFetchOptions
): Promise<T> {
  const cacheKey = cacheOptions?.cacheKey || `gc_cache_${url}`;
  const ttlMs = cacheOptions?.ttlMs ?? DEFAULT_TTL_MS;
  const force = cacheOptions?.forceRefresh ?? false;

  // 1. Check local storage cache with SWR
  if (!force) {
    const cached = getStoredItem<T>(cacheKey);
    if (cached) {
      if (!cached.isStale) {
        return cached.data;
      }
      // Stale data present: return instantly to prevent UI hang,
      // then trigger silent background revalidation
      revalidateInBackground(url, options, cacheKey, ttlMs);
      return cached.data;
    }
  }

  // 2. In-flight request deduplication
  const inFlightKey = `${options?.method || 'GET'}:${url}`;
  if (inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey) as Promise<T>;
  }

  // 3. Execute network fetch with 8-second timeout
  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const mergedSignal = options?.signal
        ? anySignal([options.signal, controller.signal])
        : controller.signal;

      const res = await fetch(url, {
        ...options,
        signal: mergedSignal,
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = await res.json();

      // Store in localStorage if request succeeded
      if (json) {
        setStoredItem(cacheKey, json, ttlMs);
      }
      return json as T;
    } finally {
      clearTimeout(timeoutId);
      inFlightRequests.delete(inFlightKey);
    }
  })();

  inFlightRequests.set(inFlightKey, fetchPromise);
  return fetchPromise;
}

/**
 * Revalidates a cache key silently in background without blocking caller.
 */
function revalidateInBackground(
  url: string,
  options: RequestInit | undefined,
  cacheKey: string,
  ttlMs: number
): void {
  const inFlightKey = `${options?.method || 'GET'}:${url}`;
  if (inFlightRequests.has(inFlightKey)) return;

  // Fire background fetch
  cachedFetch(url, options, {
    cacheKey,
    ttlMs,
    forceRefresh: true,
  }).catch(() => {});
}

/**
 * Combines multiple AbortSignals safely.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

/**
 * Prefetch all core user data in parallel once (profile, trips, notifications)
 * and populate localStorage cache.
 */
export async function prefetchCoreData(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await Promise.allSettled([
      cachedFetch('/api/profile', undefined, { cacheKey: CACHE_KEYS.PROFILE, ttlMs: 10 * 60 * 1000 }),
      cachedFetch('/api/trips', undefined, { cacheKey: CACHE_KEYS.TRIPS, ttlMs: 5 * 60 * 1000 }),
      cachedFetch('/api/notifications/unread-count', undefined, {
        cacheKey: CACHE_KEYS.NOTIFICATIONS_UNREAD,
        ttlMs: 60 * 1000,
      }),
    ]);
  } catch {}
}

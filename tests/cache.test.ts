/**
 * Phase 14B — Cache Optimization Tests
 * Tests for ServerLRUCache and client-cache utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ServerLRUCache } from '@/lib/cache/server-lru-cache';
import {
  buildTripTabCacheKey,
  getMemoryTabData,
  setMemoryTabData,
  clearMemoryTabCache,
  invalidateTripTabData,
} from '@/lib/cache/client-cache';

// ─── ServerLRUCache Tests ────────────────────────────────────────────────────

describe('ServerLRUCache', () => {
  let cache: ServerLRUCache<string, number>;

  beforeEach(() => {
    cache = new ServerLRUCache<string, number>({ maxSize: 3, ttlMs: 5000 });
  });

  it('should store and retrieve a value', () => {
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should return null for missing key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('should evict LRU entry when at capacity', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' to make it MRU
    cache.get('a');
    // Add 'd' — should evict 'b' (LRU after 'a' was accessed)
    cache.set('d', 4);
    expect(cache.get('b')).toBeNull(); // evicted
    expect(cache.get('a')).toBe(1); // still present (MRU)
    expect(cache.get('c')).toBe(3); // still present
    expect(cache.get('d')).toBe(4); // newly added
  });

  it('should return null for expired entries', async () => {
    const shortCache = new ServerLRUCache<string, number>({ maxSize: 10, ttlMs: 50 });
    shortCache.set('x', 99);
    expect(shortCache.get('x')).toBe(99);
    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 60));
    expect(shortCache.get('x')).toBeNull();
  });

  it('should not evict when updating existing key', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Update 'a' — should not evict anything (already exists)
    cache.set('a', 100);
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBe(100);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('should delete entries', () => {
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.get('a')).toBeNull();
  });

  it('should report correct size', () => {
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('should clear all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeNull();
  });

  it('should report stats', () => {
    cache.set('a', 1);
    cache.get('a'); // hit
    cache.get('missing'); // miss
    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('should respect per-entry TTL override', async () => {
    const longCache = new ServerLRUCache<string, number>({ maxSize: 10, ttlMs: 10_000 });
    longCache.set('a', 1, 50); // 50ms TTL override
    longCache.set('b', 2); // default TTL
    await new Promise((r) => setTimeout(r, 60));
    expect(longCache.get('a')).toBeNull(); // expired by override TTL
    expect(longCache.get('b')).toBe(2); // still valid
  });

  it('should maintain LRU order correctly with multiple accesses', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access order: c, a, b → b is MRU
    cache.get('c'); // c → MRU
    cache.get('a'); // a → MRU
    cache.get('b'); // b → MRU
    // Now: b(MRU) → a → c(LRU)
    // Adding new entry should evict c
    cache.set('d', 4);
    expect(cache.get('c')).toBeNull(); // LRU, evicted
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('d')).toBe(4);
  });

  it('should handle maxSize of 1', () => {
    const tinyCache = new ServerLRUCache<string, number>({ maxSize: 1, ttlMs: 60_000 });
    tinyCache.set('a', 1);
    tinyCache.set('b', 2);
    expect(tinyCache.get('a')).toBeNull(); // evicted
    expect(tinyCache.get('b')).toBe(2);
  });
});

// ─── Client Memory Tab Cache Tests ──────────────────────────────────────────

describe('Client Memory Tab Cache', () => {
  beforeEach(() => {
    clearMemoryTabCache();
  });

  it('should build correct composite key', () => {
    const key = buildTripTabCacheKey('user123', 'trip456', 'budget');
    expect(key).toBe('user:user123:trip:trip456:budget');
  });

  it('should store and retrieve tab data', () => {
    setMemoryTabData('user:u1:trip:t1:overview', { tripId: 't1' });
    const result = getMemoryTabData<{ tripId: string }>('user:u1:trip:t1:overview');
    expect(result).not.toBeNull();
    expect(result?.data.tripId).toBe('t1');
    expect(result?.isStale).toBe(false);
  });

  it('should return null for missing key', () => {
    const result = getMemoryTabData('nonexistent');
    expect(result).toBeNull();
  });

  it('should mark entries as stale after TTL', async () => {
    setMemoryTabData('testkey', 'value', 50); // 50ms TTL
    await new Promise((r) => setTimeout(r, 60));
    const result = getMemoryTabData<string>('testkey');
    expect(result?.isStale).toBe(true);
    expect(result?.data).toBe('value'); // still returns data, just marks as stale
  });

  it('should invalidate specific tab', () => {
    setMemoryTabData(buildTripTabCacheKey('u1', 't1', 'budget'), 'budget-data');
    setMemoryTabData(buildTripTabCacheKey('u1', 't1', 'weather'), 'weather-data');
    invalidateTripTabData('u1', 't1', 'budget');
    expect(getMemoryTabData(buildTripTabCacheKey('u1', 't1', 'budget'))).toBeNull();
    expect(getMemoryTabData(buildTripTabCacheKey('u1', 't1', 'weather'))).not.toBeNull();
  });

  it('should invalidate all tabs for a trip', () => {
    setMemoryTabData(buildTripTabCacheKey('u1', 't1', 'budget'), 'b');
    setMemoryTabData(buildTripTabCacheKey('u1', 't1', 'weather'), 'w');
    setMemoryTabData(buildTripTabCacheKey('u1', 't2', 'budget'), 'other-trip');
    invalidateTripTabData('u1', 't1');
    expect(getMemoryTabData(buildTripTabCacheKey('u1', 't1', 'budget'))).toBeNull();
    expect(getMemoryTabData(buildTripTabCacheKey('u1', 't1', 'weather'))).toBeNull();
    // Other trip not affected
    expect(getMemoryTabData(buildTripTabCacheKey('u1', 't2', 'budget'))).not.toBeNull();
  });

  it('should clear all entries', () => {
    setMemoryTabData('key1', 'v1');
    setMemoryTabData('key2', 'v2');
    clearMemoryTabCache();
    expect(getMemoryTabData('key1')).toBeNull();
    expect(getMemoryTabData('key2')).toBeNull();
  });

  it('should not bleed between users', () => {
    setMemoryTabData(buildTripTabCacheKey('user-a', 'trip-1', 'budget'), 'user-a-data');
    setMemoryTabData(buildTripTabCacheKey('user-b', 'trip-1', 'budget'), 'user-b-data');
    // Invalidate user-a's data
    invalidateTripTabData('user-a', 'trip-1');
    // user-b's data should be unaffected
    expect(getMemoryTabData(buildTripTabCacheKey('user-b', 'trip-1', 'budget'))?.data).toBe('user-b-data');
    expect(getMemoryTabData(buildTripTabCacheKey('user-a', 'trip-1', 'budget'))).toBeNull();
  });
});

// ─── ServerLRUCache withServerCache helper Tests ─────────────────────────────

describe('withServerCache helper', () => {
  it('should cache results from fetcher', async () => {
    const { withServerCache } = await import('@/lib/cache/server-lru-cache');
    const cache = new ServerLRUCache<string, string>({ maxSize: 10, ttlMs: 60_000 });
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return 'result';
    };

    const r1 = await withServerCache(cache, 'key', fetcher);
    const r2 = await withServerCache(cache, 'key', fetcher);

    expect(r1).toBe('result');
    expect(r2).toBe('result');
    expect(fetchCount).toBe(1); // Fetcher called only once
  });

  it('should call fetcher again after TTL expires', async () => {
    const { withServerCache } = await import('@/lib/cache/server-lru-cache');
    const cache = new ServerLRUCache<string, number>({ maxSize: 10, ttlMs: 50 });
    let fetchCount = 0;
    const fetcher = async () => ++fetchCount;

    await withServerCache(cache, 'key', fetcher);
    await new Promise((r) => setTimeout(r, 60));
    await withServerCache(cache, 'key', fetcher);

    expect(fetchCount).toBe(2); // Called again after TTL
  });
});

// ─── Phase 14B Cache Subsystem Tests ─────────────────────────────────────────

describe('Phase 14B Subsystem Caching & User Isolation', () => {
  it('should construct secure user-isolated snapshot keys for offline storage', async () => {
    const { buildSnapshotKey } = await import('@/lib/offline/offline-storage');
    const userAKey = buildSnapshotKey('user_alpha', 'trip_99');
    const userBKey = buildSnapshotKey('user_beta', 'trip_99');

    expect(userAKey).toBe('user:user_alpha:trip:trip_99');
    expect(userBKey).toBe('user:user_beta:trip:trip_99');
    expect(userAKey).not.toBe(userBKey);
  });

  it('should verify weather cache clears without errors', async () => {
    const { _clearWeatherCache, _getWeatherCacheStats } = await import('@/lib/weather/weather-service');
    _clearWeatherCache();
    const stats = _getWeatherCacheStats();
    expect(stats.trips.size).toBe(0);
    expect(stats.coords.size).toBe(0);
  });

  it('should verify routes cache clears without errors', async () => {
    const { _clearRouteCache, _getRouteCacheStats } = await import('@/lib/maps/routes');
    _clearRouteCache();
    const stats = _getRouteCacheStats();
    expect(stats.size).toBe(0);
  });

  it('should verify AI plan cache clears cleanly', async () => {
    const { _clearAiPlanCache } = await import('@/lib/ai/ai-planner-service');
    expect(() => _clearAiPlanCache()).not.toThrow();
  });

  it('should enforce distinct keys for different users with identical travel preferences', () => {
    const keyUser1 = buildTripTabCacheKey('user_1', 'trip_10', 'itinerary');
    const keyUser2 = buildTripTabCacheKey('user_2', 'trip_10', 'itinerary');

    setMemoryTabData(keyUser1, { user: 1, title: 'Secret Trip' });
    setMemoryTabData(keyUser2, { user: 2, title: 'Other Trip' });

    expect(getMemoryTabData<{ title: string }>(keyUser1)?.data.title).toBe('Secret Trip');
    expect(getMemoryTabData<{ title: string }>(keyUser2)?.data.title).toBe('Other Trip');

    // Invalidation of user 1 must not affect user 2
    invalidateTripTabData('user_1', 'trip_10', 'itinerary');
    expect(getMemoryTabData(keyUser1)).toBeNull();
    expect(getMemoryTabData(keyUser2)?.data).toEqual({ user: 2, title: 'Other Trip' });
  });

  it('should cleanly purge in-memory cache on logout', () => {
    setMemoryTabData('user:1:trip:1:overview', { data: 1 });
    setMemoryTabData('user:2:trip:2:overview', { data: 2 });
    clearMemoryTabCache();
    expect(getMemoryTabData('user:1:trip:1:overview')).toBeNull();
    expect(getMemoryTabData('user:2:trip:2:overview')).toBeNull();
  });
});

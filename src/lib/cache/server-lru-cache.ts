/**
 * ServerLRUCache — Bounded LRU Cache for Next.js server-side caching.
 *
 * Replaces raw unbounded `Map` caches found in places.ts, routes.ts, and weather-service.ts.
 *
 * Features:
 * - Configurable maximum entry count (prevents memory leak)
 * - Per-entry TTL (stale entries are not served)
 * - LRU eviction (least-recently-used entry is evicted when capacity is reached)
 * - Proactive stale entry cleanup via scheduled interval
 * - Safe concurrent access (single-threaded Node.js event loop)
 * - Zero external dependencies
 *
 * Usage:
 *   const cache = new ServerLRUCache<string, MyData>({ maxSize: 200, ttlMs: 5 * 60 * 1000 });
 *   cache.set('key', value);
 *   const entry = cache.get('key'); // null if missing or expired
 */

export interface ServerLRUCacheOptions {
  /** Maximum number of entries before LRU eviction begins. Default: 500 */
  maxSize?: number;
  /** Default time-to-live in milliseconds for all entries. Default: 5 minutes */
  ttlMs?: number;
  /** Interval in milliseconds for proactive stale entry cleanup. Default: 60 seconds */
  cleanupIntervalMs?: number;
  /** Optional label for debugging/metrics */
  label?: string;
}

interface CacheNode<K, V> {
  key: K;
  value: V;
  expiresAt: number;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
}

export class ServerLRUCache<K = string, V = unknown> {
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly label: string;

  // Doubly-linked list for O(1) LRU operations
  private head: CacheNode<K, V> | null = null; // Most recently used
  private tail: CacheNode<K, V> | null = null; // Least recently used
  private readonly map = new Map<K, CacheNode<K, V>>();

  // Stats
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;
  private _expired = 0;

  constructor(options: ServerLRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 500;
    this.defaultTtlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.label = options.label ?? 'ServerLRUCache';

    if (this.maxSize < 1) throw new Error('maxSize must be >= 1');
    if (this.defaultTtlMs < 0) throw new Error('ttlMs must be >= 0');

    // Proactive cleanup of stale entries — runs on server only
    if (typeof setInterval !== 'undefined') {
      const interval = options.cleanupIntervalMs ?? 60_000;
      const timer = setInterval(() => this._cleanup(), interval);
      // Allow Node.js process to exit even if this cache is alive
      if (timer.unref) timer.unref();
    }
  }

  /**
   * Get a cached value. Returns null if missing or expired.
   * Promotes entry to MRU position on hit.
   */
  get(key: K): V | null {
    const node = this.map.get(key);
    if (!node) {
      this._misses++;
      return null;
    }

    // Check expiry
    if (node.expiresAt <= Date.now()) {
      this._expired++;
      this._deleteNode(node);
      return null;
    }

    // Promote to head (most recently used)
    this._moveToHead(node);
    this._hits++;
    return node.value;
  }

  /**
   * Store a value. Optionally override the default TTL.
   * Evicts LRU entry if at capacity.
   */
  set(key: K, value: V, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs ?? this.defaultTtlMs);
    const existing = this.map.get(key);

    if (existing) {
      // Update existing node in-place
      existing.value = value;
      existing.expiresAt = expiry;
      this._moveToHead(existing);
      return;
    }

    // Create new node
    const node: CacheNode<K, V> = {
      key,
      value,
      expiresAt: expiry,
      prev: null,
      next: null,
    };

    this._addToHead(node);
    this.map.set(key, node);

    // Evict LRU if over capacity
    if (this.map.size > this.maxSize) {
      this._evictTail();
    }
  }

  /**
   * Explicitly delete a cache entry.
   */
  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this._deleteNode(node);
    return true;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: K): boolean {
    return this.get(key) !== null;
  }

  /**
   * Return the current number of entries (including possibly expired ones).
   */
  get size(): number {
    return this.map.size;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * Cache statistics for monitoring.
   */
  stats(): { size: number; hits: number; misses: number; evictions: number; expired: number; hitRate: string; label: string } {
    const total = this._hits + this._misses;
    return {
      label: this.label,
      size: this.map.size,
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      expired: this._expired,
      hitRate: total > 0 ? `${((this._hits / total) * 100).toFixed(1)}%` : 'N/A',
    };
  }

  // ── Private doubly-linked list operations ────────────────────────────────────

  private _addToHead(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private _removeNode(node: CacheNode<K, V>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    node.prev = null;
    node.next = null;
  }

  private _moveToHead(node: CacheNode<K, V>): void {
    if (node === this.head) return;
    this._removeNode(node);
    this._addToHead(node);
  }

  private _deleteNode(node: CacheNode<K, V>): void {
    this.map.delete(node.key);
    this._removeNode(node);
  }

  private _evictTail(): void {
    if (!this.tail) return;
    this.map.delete(this.tail.key);
    this._removeNode(this.tail);
    this._evictions++;
  }

  /**
   * Proactive cleanup: remove all expired entries.
   * Called on a background interval to prevent stale data from consuming memory.
   */
  private _cleanup(): void {
    const now = Date.now();
    // Iterate from tail (LRU) to head (MRU); expired entries are more likely at tail
    let node = this.tail;
    while (node) {
      const prev = node.prev;
      if (node.expiresAt <= now) {
        this._deleteNode(node);
        this._expired++;
      }
      node = prev;
    }
  }
}

/**
 * Helper: wrap an async function with cache-aside pattern.
 * - Returns cached result if fresh.
 * - Calls `fetcher()` on cache miss, stores result.
 * - On fetcher error, throws — does not store error results.
 */
export async function withServerCache<V>(
  cache: ServerLRUCache<string, V>,
  key: string,
  fetcher: () => Promise<V>,
  ttlMs?: number
): Promise<V> {
  const cached = cache.get(key);
  if (cached !== null) return cached;

  const result = await fetcher();
  cache.set(key, result, ttlMs);
  return result;
}

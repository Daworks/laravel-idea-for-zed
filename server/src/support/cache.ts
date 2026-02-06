/**
 * A bounded LRU-style cache with TTL support.
 * Prevents unbounded memory growth when caching Laravel project data.
 */
export class BoundedCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  constructor(
    private maxSize: number = 1000,
    private defaultTtlMs: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Remove if exists to maintain insertion order
    this.cache.delete(key);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  /** Get all non-expired values */
  values(): T[] {
    const result: T[] = [];
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      } else {
        result.push(entry.value);
      }
    }
    return result;
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > entry.ttlMs;
  }
}

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttlMs: number;
}

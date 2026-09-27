export interface ICache {
  /** Get a value by key. Returns undefined if not found or expired. */
  get<T = unknown>(key: string): Promise<T | undefined>;

  /** Set a value with optional TTL in seconds. */
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /** Delete a key. */
  delete(key: string): Promise<void>;

  /** Delete all keys matching a prefix. */
  deleteByPrefix(prefix: string): Promise<void>;

  /** Clear all cache. Use with caution. */
  clear(): Promise<void>;

  /** Increment a numeric value by 1 (atomic). */
  increment(key: string, by: number): Promise<number>;

  /** Check if a key exists. */
  has(key: string): Promise<boolean>;
}

export const CACHE_TOKEN = Symbol('CACHE_TOKEN');

// Simple in-memory cache with TTL support
type CacheEntry<T> = {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<any>>()

/**
 * Get item from cache if not expired
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null

  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }

  return entry.data
}

/**
 * Set item in cache with TTL in seconds
 */
export function setCached<T>(key: string, data: T, ttlSeconds: number = 60): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

/**
 * Clear specific cache key
 */
export function clearCache(key: string): void {
  cache.delete(key)
}

/**
 * Clear all cache with prefix (useful for user-specific data)
 */
export function clearCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  cache.clear()
}

/**
 * Get or compute with fallback
 */
export async function getOrCompute<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const cached = getCached<T>(key)
  if (cached) return cached

  const data = await compute()
  setCached(key, data, ttlSeconds)
  return data
}

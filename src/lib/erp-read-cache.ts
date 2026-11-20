/**
 * Zero-dependency client-safe Stale-While-Revalidate (SWR) read cache for AetherBI `/erp/**`.
 *
 * Architecture:
 * - L1 in-memory `Map` for <0.1ms synchronous route-to-route & period-switch hydration.
 * - L2 `window.sessionStorage` (`aether:read-cache:v2:*`) for <5ms tab/layout hydration (SSR-safe & quota-safe).
 * - Concurrent identical GET request deduplication via `inflightMap`.
 * - Automatic global cache purge on `window` `'aether:odoo-sync'` and `'aether:bust-read-cache'` events.
 */

export const ERP_READ_CACHE_PREFIX = 'aether:read-cache:v2:'
const LEGACY_SUMMARY_CACHE_PREFIX = 'aether_live_odoo_summary_v1:'

export const DEFAULT_ERP_CACHE_TTL_MS = 60_000
export const DEFAULT_ERP_CACHE_MAX_STALE_MS = 15 * 60_000

export const ERP_ODOO_SYNC_EVENT = 'aether:odoo-sync'
export const ERP_BUST_CACHE_EVENT = 'aether:bust-read-cache'

export interface ErpReadCacheEntry<T = unknown> {
  data: T
  savedAt: number
}

export interface PeekErpReadCacheOptions {
  ttlMs?: number
  maxStaleMs?: number
}

export interface PeekErpReadCacheResult<T> {
  data: T
  savedAt: number
  ageMs: number
  isFresh: boolean
  isStale: boolean
}

export interface ErpReadCacheOptions<T = unknown> {
  ttlMs?: number
  maxStaleMs?: number
  forceRefresh?: boolean
  onRevalidate?: (freshData: T) => void
  shouldCache?: (data: T) => boolean
}

const memoryCache = new Map<string, ErpReadCacheEntry<unknown>>()
const inflightMap = new Map<string, Promise<unknown>>()
let cacheBustEpoch = 0
let attachedTarget: EventTarget | null = null

function getSessionStorageSafe(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage ?? null
  } catch {
    return null
  }
}

function toStorageKey(key: string): string {
  return `${ERP_READ_CACHE_PREFIX}${key}`
}

function removeSingleCachedEntry(key: string): void {
  memoryCache.delete(key)
  const storage = getSessionStorageSafe()
  if (!storage) return
  try {
    storage.removeItem(toStorageKey(key))
  } catch {
    // ignore storage access errors
  }
}

/**
 * Purges cached read entries from L1 memory, in-flight map, and L2 `sessionStorage`.
 * When `prefix` is omitted, purges all cached entries immediately.
 */
export function bustErpReadCache(prefix?: string): void {
  cacheBustEpoch += 1
  const cleanPrefix = typeof prefix === 'string' && prefix.length > 0 ? prefix : null

  if (!cleanPrefix) {
    memoryCache.clear()
    inflightMap.clear()
    const storage = getSessionStorageSafe()
    if (!storage) return
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < storage.length; i += 1) {
        const storageKey = storage.key(i)
        if (
          storageKey &&
          (storageKey.startsWith(ERP_READ_CACHE_PREFIX) ||
            storageKey.startsWith(LEGACY_SUMMARY_CACHE_PREFIX))
        ) {
          keysToRemove.push(storageKey)
        }
      }
      for (const storageKey of keysToRemove) {
        storage.removeItem(storageKey)
      }
    } catch {
      // ignore storage quota/security errors
    }
    return
  }

  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(cleanPrefix)) {
      memoryCache.delete(key)
    }
  }
  for (const key of [...inflightMap.keys()]) {
    if (key.startsWith(cleanPrefix)) {
      inflightMap.delete(key)
    }
  }

  const storage = getSessionStorageSafe()
  if (!storage) return
  try {
    const fullPrefix = toStorageKey(cleanPrefix)
    const keysToRemove: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const storageKey = storage.key(i)
      if (storageKey && storageKey.startsWith(fullPrefix)) {
        keysToRemove.push(storageKey)
      }
    }
    for (const storageKey of keysToRemove) {
      storage.removeItem(storageKey)
    }
  } catch {
    // ignore storage errors
  }
}

function handleWindowOdooSync(): void {
  bustErpReadCache()
}

function handleWindowBustCache(event: Event): void {
  const customDetail = (event as CustomEvent<{ prefix?: string } | string | undefined>).detail
  if (typeof customDetail === 'string') {
    bustErpReadCache(customDetail)
    return
  }
  if (customDetail && typeof customDetail === 'object' && typeof customDetail.prefix === 'string') {
    bustErpReadCache(customDetail.prefix)
    return
  }
  bustErpReadCache()
}

function ensureBrowserListenersAttached(): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return
  }
  if (attachedTarget === window) {
    return
  }
  if (attachedTarget && typeof attachedTarget.removeEventListener === 'function') {
    try {
      attachedTarget.removeEventListener(ERP_ODOO_SYNC_EVENT, handleWindowOdooSync)
      attachedTarget.removeEventListener(ERP_BUST_CACHE_EVENT, handleWindowBustCache)
    } catch {
      // ignore detached window errors
    }
  }
  attachedTarget = window
  window.addEventListener(ERP_ODOO_SYNC_EVENT, handleWindowOdooSync)
  window.addEventListener(ERP_BUST_CACHE_EVENT, handleWindowBustCache)
}

if (typeof window !== 'undefined') {
  ensureBrowserListenersAttached()
}

/**
 * Inspects L1 memory + L2 `sessionStorage` synchronously and returns entry metadata if within `maxStaleMs`.
 */
export function inspectErpReadCacheEntry<T>(
  key: string,
  options?: PeekErpReadCacheOptions,
): PeekErpReadCacheResult<T> | null {
  ensureBrowserListenersAttached()
  const ttlMs = Math.max(0, options?.ttlMs ?? DEFAULT_ERP_CACHE_TTL_MS)
  const maxStaleMs = Math.max(ttlMs, options?.maxStaleMs ?? DEFAULT_ERP_CACHE_MAX_STALE_MS)
  const now = Date.now()

  let entry = memoryCache.get(key) as ErpReadCacheEntry<T> | undefined
  if (!entry) {
    const storage = getSessionStorageSafe()
    if (storage) {
      try {
        const raw = storage.getItem(toStorageKey(key))
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ErpReadCacheEntry<T>> | null
          if (
            parsed &&
            typeof parsed === 'object' &&
            typeof parsed.savedAt === 'number' &&
            Number.isFinite(parsed.savedAt) &&
            'data' in parsed &&
            parsed.data !== undefined
          ) {
            entry = { data: parsed.data as T, savedAt: parsed.savedAt }
            memoryCache.set(key, entry)
          } else {
            storage.removeItem(toStorageKey(key))
          }
        }
      } catch {
        // ignore JSON parse or storage access errors
      }
    }
  }

  if (!entry) {
    return null
  }

  const ageMs = Math.max(0, now - entry.savedAt)
  if (ageMs > maxStaleMs) {
    removeSingleCachedEntry(key)
    return null
  }

  const isFresh = ageMs <= ttlMs
  return {
    data: entry.data,
    savedAt: entry.savedAt,
    ageMs,
    isFresh,
    isStale: !isFresh,
  }
}

/**
 * Synchronously peeks warm cached data (`<5ms`) from L1 memory or L2 `sessionStorage`.
 * Returns `null` if missing or older than `maxStaleMs`.
 */
export function peekErpReadCache<T>(
  key: string,
  options?: PeekErpReadCacheOptions,
): T | null {
  const inspected = inspectErpReadCacheEntry<T>(key, options)
  return inspected ? inspected.data : null
}

/**
 * Writes validated data into L1 in-memory `Map` and L2 `sessionStorage` (quota-safe).
 */
export function writeErpReadCache<T>(key: string, data: T): void {
  ensureBrowserListenersAttached()
  const entry: ErpReadCacheEntry<T> = {
    data,
    savedAt: Date.now(),
  }
  memoryCache.set(key, entry)

  const storage = getSessionStorageSafe()
  if (!storage) return
  const storageKey = toStorageKey(key)
  const serialized = JSON.stringify(entry)
  try {
    storage.setItem(storageKey, serialized)
  } catch {
    // Quota exceeded: evict oldest `aether:read-cache:v2:*` entries and retry once
    try {
      const candidates: { storageKey: string; savedAt: number }[] = []
      for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i)
        if (!k || !k.startsWith(ERP_READ_CACHE_PREFIX)) continue
        const raw = storage.getItem(k)
        let savedAt = 0
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { savedAt?: number }
            savedAt = typeof parsed?.savedAt === 'number' ? parsed.savedAt : 0
          } catch {
            savedAt = 0
          }
        }
        candidates.push({ storageKey: k, savedAt })
      }
      candidates.sort((a, b) => a.savedAt - b.savedAt)
      const removeCount = Math.max(1, Math.ceil(candidates.length / 2))
      for (let i = 0; i < removeCount && i < candidates.length; i += 1) {
        storage.removeItem(candidates[i].storageKey)
      }
      storage.setItem(storageKey, serialized)
    } catch {
      // L1 memoryCache still holds the entry even if sessionStorage is disabled/full
    }
  }
}

function invokeFetcherSafely<T>(fetcher: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(fetcher())
  } catch (err) {
    return Promise.reject(err)
  }
}

function startSharedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: ErpReadCacheOptions<T>,
  replaceExistingInflight = false,
): Promise<T> {
  if (!replaceExistingInflight) {
    const existing = inflightMap.get(key)
    if (existing) {
      return existing as Promise<T>
    }
  }

  const startEpoch = cacheBustEpoch
  const requestPromise = invokeFetcherSafely(fetcher)
    .then((freshData) => {
      const canStore = options?.shouldCache
        ? options.shouldCache(freshData)
        : freshData !== null && freshData !== undefined
      if (canStore && startEpoch === cacheBustEpoch) {
        writeErpReadCache(key, freshData)
        options?.onRevalidate?.(freshData)
      }
      return freshData
    })
    .finally(() => {
      if (inflightMap.get(key) === requestPromise) {
        inflightMap.delete(key)
      }
    })

  inflightMap.set(key, requestPromise)
  return requestPromise
}

/**
 * Stale-While-Revalidate (SWR) read wrapper with concurrent in-flight GET deduplication:
 * - Fresh hit (`age <= ttlMs` and `!forceRefresh`): resolves immediately from cache with zero network traffic.
 * - Stale hit (`ttlMs < age <= maxStaleMs` and `!forceRefresh`): resolves immediately from warm cache while silently revalidating in the background.
 * - Cold miss / expired / `forceRefresh`: deduplicates concurrent identical requests and populates L1 + L2 cache.
 */
export function fetchWithErpReadCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: ErpReadCacheOptions<T>,
): Promise<T> {
  ensureBrowserListenersAttached()
  const forceRefresh = Boolean(options?.forceRefresh)
  if (forceRefresh) {
    removeSingleCachedEntry(key)
    return startSharedFetch(key, fetcher, options, true)
  }

  const inspected = inspectErpReadCacheEntry<T>(key, {
    ttlMs: options?.ttlMs,
    maxStaleMs: options?.maxStaleMs,
  })

  if (inspected) {
    if (inspected.isFresh) {
      return Promise.resolve(inspected.data)
    }
    // Stale-while-revalidate: return warm data immediately and refresh silently in background
    void startSharedFetch(key, fetcher, options, false).catch(() => {
      // Preserve warm stale entry when background revalidation encounters a transient network error
    })
    return Promise.resolve(inspected.data)
  }

  return startSharedFetch(key, fetcher, options, false)
}

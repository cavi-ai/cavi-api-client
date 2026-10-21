import { abortError } from "../../error-factories.js";

type CacheEntry = { inFlight: Promise<unknown> | null; expiresAt?: number };
const CAPACITY = 256;

/** Live requests stay registered; settled entries are bounded and expire lazily. */
export function pruneCache<T extends CacheEntry>(cache: Map<string, T>, keep?: string): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (key !== keep && !entry.inFlight && entry.expiresAt !== undefined && entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
  for (const [key, entry] of cache) {
    if (cache.size <= CAPACITY) break;
    if (key !== keep && !entry.inFlight) cache.delete(key);
  }
}

export function getCacheEntry<T extends CacheEntry>(cache: Map<string, T>, key: string, create: () => T): T {
  const entry = cache.get(key) ?? create();
  cache.delete(key);
  cache.set(key, entry);
  pruneCache(cache, key);
  return entry;
}

export function checkCacheSignal(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : abortError();
}

/** The cache owns the request; each observer owns only its local wait. */
export function observeCacheRequest<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(signal.reason instanceof Error ? signal.reason : abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    request.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) onAbort();
  });
}

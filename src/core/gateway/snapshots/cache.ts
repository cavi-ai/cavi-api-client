import { getCacheEntry } from "./cache-internals.js";

export type TtlCacheEntry<TPayload> = {
  payload: TPayload | null;
  expiresAt: number;
  inFlight: Promise<TPayload> | null;
};

export function getOrCreateTtlCacheEntry<TPayload>(
  cache: Map<string, TtlCacheEntry<TPayload>>,
  cacheKey: string,
): TtlCacheEntry<TPayload> {
  return getCacheEntry(cache, cacheKey, () => ({
    payload: null,
    expiresAt: 0,
    inFlight: null,
  }));
}

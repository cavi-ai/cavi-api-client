export type TtlCacheEntry<TPayload> = {
  payload: TPayload | null;
  expiresAt: number;
  inFlight: Promise<TPayload> | null;
};

export function getOrCreateTtlCacheEntry<TPayload>(
  cache: Map<string, TtlCacheEntry<TPayload>>,
  cacheKey: string,
): TtlCacheEntry<TPayload> {
  const existing = cache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const entry: TtlCacheEntry<TPayload> = {
    payload: null,
    expiresAt: 0,
    inFlight: null,
  };
  cache.set(cacheKey, entry);
  return entry;
}

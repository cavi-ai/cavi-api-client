import { describe, expect, it, vi } from "vitest";
import { createSessionLoaders, type GatewaySessionOperations } from "../../../../core/gateway/snapshots/index.js";
import { getOrCreateTtlCacheEntry, type TtlCacheEntry } from "../../../../core/gateway/snapshots/cache.js";
import type { SessionDetailPayload } from "../../../../core/gateway/snapshots/session-loaders.js";

function ports(detail: GatewaySessionOperations["detail"]): GatewaySessionOperations {
  return { detail, list: vi.fn(), usage: vi.fn(), preview: vi.fn(), patch: vi.fn() };
}

describe("snapshot cache ownership", () => {
  it("lets callers abort independently while sharing a cache-owned request", async () => {
    let finish!: (value: SessionDetailPayload) => void;
    const detail = vi.fn<GatewaySessionOperations["detail"]>((_params, options) => new Promise((resolve, reject) => {
      finish = resolve;
      options?.signal?.addEventListener("abort", () => reject(new Error("shared request aborted")));
    }));
    const loaders = createSessionLoaders(null, { operations: ports(detail) });
    const first = new AbortController();
    const second = new AbortController();
    const a = loaders.loadSessionDetailRaw({ key: "same" }, { signal: first.signal });
    const b = loaders.loadSessionDetailRaw({ key: "same" }, { signal: second.signal });
    const rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    first.abort();
    finish({ key: "same" });
    await rejected;
    await expect(b).resolves.toEqual({ key: "same" });
    expect(detail).toHaveBeenCalledTimes(1);
    expect(detail.mock.calls[0]![1]?.signal).not.toBe(first.signal);
  });

  it("rejects a pre-aborted caller even when a cached payload is available", async () => {
    const detail = vi.fn<GatewaySessionOperations["detail"]>().mockResolvedValue({ key: "same" });
    const loaders = createSessionLoaders(null, { operations: ports(detail) });
    await loaders.loadSessionDetailRaw({ key: "same" });
    const controller = new AbortController();
    controller.abort();
    await expect(loaders.loadSessionDetailRaw({ key: "same" }, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(detail).toHaveBeenCalledTimes(1);
  });

  it("evicts inactive keys while retaining live requests", () => {
    const cache = new Map<string, TtlCacheEntry<number>>();
    const active = getOrCreateTtlCacheEntry(cache, "active");
    active.inFlight = new Promise(() => {});
    for (let n = 0; n < 600; n++) {
      const entry = getOrCreateTtlCacheEntry(cache, String(n));
      entry.payload = n;
      entry.expiresAt = Date.now() + 60_000;
    }
    expect(cache.size).toBeLessThanOrEqual(256);
    expect(cache.get("active")).toBe(active);
    expect(cache.has("0")).toBe(false);
  });

  it("drops expired payloads for keys that are not revisited", () => {
    const cache = new Map<string, TtlCacheEntry<number>>();
    const old = getOrCreateTtlCacheEntry(cache, "expired");
    old.payload = 42;
    old.expiresAt = Date.now() - 1;
    getOrCreateTtlCacheEntry(cache, "fresh");
    expect(cache.has("expired")).toBe(false);
  });

  it("retains all live keys while pruning completed requests back to capacity", async () => {
    const finishes: Array<() => void> = [];
    const detail = vi.fn<GatewaySessionOperations["detail"]>(params => new Promise(resolve => {
      finishes.push(() => resolve({ key: params.key }));
    }));
    const loaders = createSessionLoaders(null, { operations: ports(detail) });
    const reads = Array.from({ length: 300 }, (_, n) => loaders.loadSessionDetailRaw({ key: String(n) }));
    const shared = loaders.loadSessionDetailRaw({ key: "0" });
    expect(detail).toHaveBeenCalledTimes(300);
    finishes.forEach(finish => finish());
    await Promise.all([...reads, shared]);
    const next = loaders.loadSessionDetailRaw({ key: "0" });
    expect(detail).toHaveBeenCalledTimes(301);
    finishes[300]!();
    await next;
  });
});

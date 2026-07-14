import { describe, expect, it, vi } from "vitest";

import {
  createOpenClawSessionOperations,
  createSessionLoaders,
  type GatewaySessionOperations,
  type GatewaySessionRequestOptions,
} from "../../../../core/gateway/snapshots/index.js";
import type { GatewayRpcClient } from "../../../../core/gateway/rpc/client.js";

describe("gateway session operation injection", () => {
  it("delegates every loader operation through the injected port", async () => {
    const listPayload = { sessions: [], hash: "list-hash" };
    const usagePayload = {
      sessions: [],
      aggregates: {
        byProvider: [],
        byAgent: [],
        messages: { total: 0, toolCalls: 0, errors: 0 },
      },
      totals: { totalCost: 0 },
    };
    const previewPayload = { previews: [] };
    const detailPayload = { key: "agent:alpha:main", row: null };
    const operations: GatewaySessionOperations = {
      list: vi.fn().mockResolvedValue(listPayload),
      usage: vi.fn().mockResolvedValue(usagePayload),
      preview: vi.fn().mockResolvedValue(previewPayload),
      detail: vi.fn().mockResolvedValue(detailPayload),
      patch: vi.fn().mockResolvedValue(undefined),
    };
    const loaders = createSessionLoaders(null, { operations });
    const requestOptions: GatewaySessionRequestOptions = {
      signal: new AbortController().signal,
    };

    await expect(
      loaders.loadSessionsListRaw({ limit: 20 }, requestOptions),
    ).resolves.toEqual(listPayload);
    await expect(
      loaders.loadSessionsUsageRaw(
        { key: "agent:alpha:main" },
        requestOptions,
      ),
    ).resolves.toEqual(usagePayload);
    await expect(
      loaders.loadSessionsPreviewRaw(
        { keys: ["agent:alpha:main"] },
        requestOptions,
      ),
    ).resolves.toEqual(previewPayload);
    await expect(
      loaders.loadSessionDetailRaw(
        { key: "agent:alpha:main" },
        requestOptions,
      ),
    ).resolves.toEqual(detailPayload);
    await expect(
      loaders.patchSession(
        { key: "agent:alpha:main", label: "Alpha" },
        requestOptions,
      ),
    ).resolves.toBeUndefined();

    expect(operations.list).toHaveBeenCalledWith({ limit: 20 }, requestOptions);
    expect(operations.usage).toHaveBeenCalledWith(
      { key: "agent:alpha:main" },
      requestOptions,
    );
    expect(operations.preview).toHaveBeenCalledWith({
      keys: ["agent:alpha:main"],
    }, requestOptions);
    expect(operations.detail).toHaveBeenCalledWith(
      { key: "agent:alpha:main" },
      requestOptions,
    );
    expect(operations.patch).toHaveBeenCalledWith(
      { key: "agent:alpha:main", label: "Alpha" },
      requestOptions,
    );
  });

  it("forwards request options through the sessions.list unchanged retry", async () => {
    const requestOptions: GatewaySessionRequestOptions = {
      signal: new AbortController().signal,
    };
    const list = vi
      .fn<GatewaySessionOperations["list"]>()
      .mockResolvedValueOnce({ unchanged: true, hash: "unchanged-hash" })
      .mockResolvedValueOnce({ sessions: [], hash: "fresh-hash" });
    const operations = {
      list,
      usage: vi.fn(),
      preview: vi.fn(),
      detail: vi.fn(),
      patch: vi.fn(),
    } as GatewaySessionOperations;
    const loaders = createSessionLoaders(null, { operations });

    await loaders.loadSessionsListRaw({ limit: 20 }, requestOptions);

    expect(list).toHaveBeenNthCalledWith(1, { limit: 20 }, requestOptions);
    expect(list).toHaveBeenNthCalledWith(2, { limit: 20 }, requestOptions);
  });

  it.each(["list", "usage", "preview", "detail", "patch"] as const)(
    "rejects pre-aborted RPC %s before invoking the legacy client",
    async (operation) => {
      const request = vi.fn();
      const adapter = createOpenClawSessionOperations({
        request,
      } as unknown as GatewayRpcClient);
      const controller = new AbortController();
      controller.abort();
      const inputs = {
        list: { limit: 1 },
        usage: { key: "agent:alpha:main" },
        preview: { keys: ["agent:alpha:main"] },
        detail: { key: "agent:alpha:main" },
        patch: { key: "agent:alpha:main", label: "Alpha" },
      } as const;

      await expect(
        adapter[operation](inputs[operation] as never, {
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("forwards pre-aborted options through the released REST fallback", async () => {
    const requestJson = vi.fn();
    const loaders = createSessionLoaders(null, { requestJson });
    const controller = new AbortController();
    controller.abort();
    const requestOptions = { signal: controller.signal };

    await expect(
      loaders.loadSessionsListRaw({ limit: 1 }, requestOptions),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      loaders.loadSessionsUsageRaw({}, requestOptions),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      loaders.loadSessionsPreviewRaw({ keys: [] }, requestOptions),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      loaders.loadSessionDetailRaw({ key: "session" }, requestOptions),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      loaders.patchSession({ key: "session" }, requestOptions),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(requestJson).not.toHaveBeenCalled();
  });
});

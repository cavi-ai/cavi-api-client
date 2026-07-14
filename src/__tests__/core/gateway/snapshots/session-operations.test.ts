import { describe, expect, it, vi } from "vitest";

import {
  createSessionLoaders,
  type GatewaySessionOperations,
} from "../../../../core/gateway/snapshots/index.js";

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

    await expect(loaders.loadSessionsListRaw({ limit: 20 })).resolves.toEqual(
      listPayload,
    );
    await expect(
      loaders.loadSessionsUsageRaw({ key: "agent:alpha:main" }),
    ).resolves.toEqual(usagePayload);
    await expect(
      loaders.loadSessionsPreviewRaw({ keys: ["agent:alpha:main"] }),
    ).resolves.toEqual(previewPayload);
    await expect(
      loaders.loadSessionDetailRaw({ key: "agent:alpha:main" }),
    ).resolves.toEqual(detailPayload);
    await expect(
      loaders.patchSession({ key: "agent:alpha:main", label: "Alpha" }),
    ).resolves.toBeUndefined();

    expect(operations.list).toHaveBeenCalledWith({ limit: 20 });
    expect(operations.usage).toHaveBeenCalledWith({ key: "agent:alpha:main" });
    expect(operations.preview).toHaveBeenCalledWith({
      keys: ["agent:alpha:main"],
    });
    expect(operations.detail).toHaveBeenCalledWith({ key: "agent:alpha:main" });
    expect(operations.patch).toHaveBeenCalledWith({
      key: "agent:alpha:main",
      label: "Alpha",
    });
  });
});

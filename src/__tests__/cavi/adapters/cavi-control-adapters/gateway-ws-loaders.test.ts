import { describe, expect, it, vi } from "vitest";
import type { GatewayWebSocketClient } from "../../../../core/ws";
import { createGatewayWsLoaders } from "../../../../cavi/adapters/cavi-control-adapters/gateway-ws-loaders";
import type { JsonHttpRequest } from "../../../../core/http/json-client";

function createMockGatewayClient(
  handler: (method: string, params: Record<string, unknown>) => Promise<unknown>,
): GatewayWebSocketClient {
  return {
    request: vi.fn(handler),
  } as unknown as GatewayWebSocketClient;
}

function createUnusedRequestJson(): JsonHttpRequest {
  return vi.fn(async () => {
    throw new Error("unexpected HTTP fallback call");
  }) as JsonHttpRequest;
}

describe("createGatewayWsLoaders", () => {
  it("uses the shared sessions.list cache for unchanged gateway payloads", async () => {
    const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (method !== "sessions.list") {
        throw new Error(`unexpected RPC method: ${method}`);
      }
      if (params.lastHash === "hash-1") {
        return {
          unchanged: true,
          hash: "hash-1",
          count: 1,
          ts: 2,
        };
      }
      return {
        sessions: [
          {
            key: "run-1",
            label: "Cached run",
            agentId: "agent-1",
            updatedAt: 1_710_000_000_000,
          },
        ],
        hash: "hash-1",
        count: 1,
        ts: 1,
      };
    });
    const loaders = createGatewayWsLoaders({
      client: createMockGatewayClient(request),
      requestJson: createUnusedRequestJson(),
    });

    const first = await loaders.loadSessionsListRaw({ limit: 10 });
    const second = await loaders.loadSessionsListRaw({ limit: 10 });

    expect(second.sessions).toEqual(first.sessions);
    expect(second.count).toBe(1);
    expect(request).toHaveBeenNthCalledWith(
      2,
      "sessions.list",
      expect.objectContaining({ lastHash: "hash-1" }),
    );
  });

  it("reuses the baseline sessions cache when loading run detail", async () => {
    const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (method === "sessions.list") {
        if (params.search) {
          throw new Error("run detail should use the cached baseline row");
        }
        return {
          sessions: [
            {
              key: "run-1",
              label: "Baseline run",
              agentId: "agent-1",
              updatedAt: 1_710_000_000_000,
            },
          ],
          hash: "baseline-hash",
          count: 1,
        };
      }
      if (method === "sessions.usage") {
        return {
          sessions: [
            {
              key: "run-1",
              usage: {
                totalTokens: 123,
                totalCost: 0.45,
                messageCounts: {
                  total: 3,
                  toolCalls: 1,
                  errors: 0,
                },
              },
            },
          ],
        };
      }
      if (method === "sessions.preview") {
        return {
          previews: [
            {
              key: "run-1",
              status: "ok",
              items: [{ role: "assistant", text: "Ready", at: 1 }],
            },
          ],
        };
      }
      throw new Error(`unexpected RPC method: ${method}`);
    });
    const loaders = createGatewayWsLoaders({
      client: createMockGatewayClient(request),
      requestJson: createUnusedRequestJson(),
    });

    await loaders.loadSessionsListRaw({
      limit: 300,
      includeGlobal: true,
      includeUnknown: true,
      includeDerivedTitles: true,
    });
    const detail = await loaders.loadRunDetail("run-1");

    expect(detail.source).toBe("gateway");
    expect(detail.data.run?.key).toBe("run-1");
    expect(detail.data.run?.title).toBe("Baseline run");
    expect(detail.data.usage.totalTokens).toBe(123);
    expect(
      request.mock.calls.filter(
        ([method, params]) =>
          method === "sessions.list" &&
          Boolean((params as Record<string, unknown>).search),
      ),
    ).toEqual([]);
  });

  it("uses HTTP fallback for session loaders when the gateway client is missing", async () => {
    const requestJson = vi.fn(async () => ({
      sessions: [
        {
          key: "run-http",
          label: "HTTP run",
          agentId: "agent-http",
        },
      ],
      hash: "http-hash",
      count: 1,
    })) as JsonHttpRequest;
    const loaders = createGatewayWsLoaders({
      client: null,
      requestJson,
    });

    const result = await loaders.loadSessionsListRaw({
      limit: 10,
      includeGlobal: true,
    });

    expect(result.sessions?.[0]?.key).toBe("run-http");
    expect(requestJson).toHaveBeenCalledWith(
      expect.stringContaining("/api/sessions/list?"),
    );
  });

  it("routes session patch through the shared loader so HTTP fallback works", async () => {
    const requestJson = vi.fn(async () => ({})) as JsonHttpRequest;
    const loaders = createGatewayWsLoaders({
      client: null,
      requestJson,
    });

    await loaders.patchSessionRaw({
      key: "run-1",
      label: "Focus",
      fastMode: true,
    });

    expect(requestJson).toHaveBeenCalledWith("/api/sessions/patch", {
      method: "PATCH",
      body: {
        key: "run-1",
        label: "Focus",
        fastMode: true,
      },
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createGatewaySystemLoaders,
  type GatewayRpcClient,
} from "../../../core/gateway";
import { GATEWAY_SYSTEM_RPC_METHODS } from "../../../contracts/paths";

describe("createGatewaySystemLoaders", () => {
  it("uses current health and shared logs.tail RPC method constants", async () => {
    const request = vi.fn(
      async (method: string, params?: Record<string, unknown>) => {
        if (method === GATEWAY_SYSTEM_RPC_METHODS.health) {
          return {
            ok: true,
            plugins: { errors: [] },
            ts: 1,
            durationMs: 2,
          };
        }
        if (method === GATEWAY_SYSTEM_RPC_METHODS.logsTail) {
          return {
            file: "gateway.log",
            cursor: 10,
            size: 10,
            lines: ["ready"],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    );
    const loaders = createGatewaySystemLoaders({
      request,
    } as unknown as GatewayRpcClient);

    await expect(loaders.loadHealthSnapshotRaw()).resolves.toEqual({
      ready: true,
      failing: [],
      uptimeMs: null,
    });
    await expect(
      loaders.loadLogsTailRaw({ limit: 1, maxBytes: 100 }),
    ).resolves.toMatchObject({
      file: "gateway.log",
      lines: ["ready"],
    });
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      GATEWAY_SYSTEM_RPC_METHODS.health,
      GATEWAY_SYSTEM_RPC_METHODS.logsTail,
    ]);
  });

  it("falls back to legacy health.snapshot when health is unavailable", async () => {
    const request = vi.fn(
      async (method: string) => {
        if (method === GATEWAY_SYSTEM_RPC_METHODS.health) {
          throw new Error("unknown method: health");
        }
        if (method === GATEWAY_SYSTEM_RPC_METHODS.healthSnapshot) {
          return { ready: true, failing: [], uptimeMs: 123 };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    );
    const loaders = createGatewaySystemLoaders({
      request,
    } as unknown as GatewayRpcClient);

    await expect(loaders.loadHealthSnapshotRaw()).resolves.toEqual({
      ready: true,
      failing: [],
      uptimeMs: 123,
    });
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      GATEWAY_SYSTEM_RPC_METHODS.health,
      GATEWAY_SYSTEM_RPC_METHODS.healthSnapshot,
    ]);
  });
});

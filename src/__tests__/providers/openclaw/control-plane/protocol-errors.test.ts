import { describe, expect, it, vi } from "vitest";

import { ApiClientErrorCode } from "../../../../core/errors.js";
import { createOpenClawControlPlane } from "../../../../providers/openclaw/control-plane/factory.js";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc.js";

function rpcWith(payload: unknown): OpenClawRpc {
  return {
    request: vi.fn(async () => payload),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("OpenClaw operation protocol errors", () => {
  it.each([
    ["models.list", (plane: Awaited<ReturnType<typeof createOpenClawControlPlane>>) => plane.models.listModels()],
    ["models.authStatus", (plane: Awaited<ReturnType<typeof createOpenClawControlPlane>>) => plane.authStatus.listAuthStatus()],
    ["sessions.list", (plane: Awaited<ReturnType<typeof createOpenClawControlPlane>>) => plane.sessions.listSessions()],
    ["usage.status", (plane: Awaited<ReturnType<typeof createOpenClawControlPlane>>) => plane.usage.getUsage()],
    ["tasks.list", (plane: Awaited<ReturnType<typeof createOpenClawControlPlane>>) => plane.tasks.listTasks()],
    ["agents.list", (plane: Awaited<ReturnType<typeof createOpenClawControlPlane>>) => plane.workspace.listWorkspaces()],
  ] as const)("maps malformed %s payloads to sanitized canonical errors", async (operation, invoke) => {
    const payload = { authorization: "Bearer top-secret" };
    const plane = await createOpenClawControlPlane({ rpc: rpcWith(payload) });
    await expect(invoke(plane)).rejects.toMatchObject({
      code: ApiClientErrorCode.TransportProtocolError,
      runtime: { provider: "openclaw", transport: "websocket", operation, retryable: false },
    });
    try { await invoke(plane); } catch (error) {
      expect(JSON.stringify(error)).not.toContain("top-secret");
      expect((error as Error).cause).toBeUndefined();
    }
  });

  it("preserves upstream RPC errors", async () => {
    const upstream = new Error("upstream rpc failure");
    const rpc = rpcWith(null);
    vi.mocked(rpc.request).mockRejectedValue(upstream);
    const plane = await createOpenClawControlPlane({ rpc });
    await expect(plane.models.listModels()).rejects.toBe(upstream);
  });
});

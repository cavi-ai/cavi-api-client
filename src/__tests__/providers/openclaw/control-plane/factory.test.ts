import { describe, expect, it, vi } from "vitest";

import { GATEWAY_RAW_EXTENSION } from "../../../../core/runtime/control-plane/raw-gateway.js";
import { createOpenClawRuntimeControlClient } from "../../../../providers/openclaw/control-plane/factory.js";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc.js";

function createRpc(): OpenClawRpc {
  return {
    request: vi.fn(async () => ({ ok: true })),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("OpenClaw raw gateway factory extension", () => {
  it("installs the exact raw gateway extension on successful clients", async () => {
    const client = await createOpenClawRuntimeControlClient({ rpc: createRpc() });
    expect(client.extensions.list()).toEqual(["gateway.raw"]);
    expect(client.extensions.get(GATEWAY_RAW_EXTENSION)).toBeDefined();
  });

  it("shares one owned RPC disposal across channel-first and runtime-first call orders", async () => {
    for (const channelFirst of [true, false]) {
      const rpc = createRpc();
      const client = await createOpenClawRuntimeControlClient({ rpc, takeRpcOwnership: true });
      const channel = client.extensions.get(GATEWAY_RAW_EXTENSION);
      expect(channel).toBeDefined();

      if (channelFirst) {
        await channel?.dispose();
        await client.dispose();
      } else {
        await client.dispose();
        await channel?.dispose();
      }
      expect(rpc.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps injected RPC caller-owned while disposing channel listeners", async () => {
    const unsubscribe = vi.fn();
    const rpc = createRpc();
    vi.mocked(rpc.subscribe).mockReturnValue(unsubscribe);
    const client = await createOpenClawRuntimeControlClient({ rpc });
    const channel = client.extensions.get(GATEWAY_RAW_EXTENSION);
    channel?.subscribe(() => undefined);

    await channel?.dispose();
    await client.dispose();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(rpc.dispose).not.toHaveBeenCalled();
  });
});

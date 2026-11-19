import { describe, expect, it } from "vitest";
import { OpenClawApiClient } from "../../../providers/openclaw/client.js";

describe("OpenClaw canonical status option", () => {
  it.each([
    ["ok", "completed"],
    ["error", "failed"],
    ["timed_out", "failed"],
    ["pending", "running"],
    ["timeout", "running"],
    ["aborted", "cancelled"],
    ["canceled", "cancelled"],
    ["cancelled", "cancelled"],
    ["toString", "toString"],
  ])("maps %s to %s while retaining native status and exact text", async (native, canonical) => {
    const rpcClient = { request: async <T>() => ({ status: native, output: "  exact\n", response: "" }) as T };
    const client = new OpenClawApiClient({ baseUrl: "http://gateway.test", rpcClient, normalizeRunStatus: true });
    expect(await client.getRun("run")).toMatchObject({ status: canonical, provider_status: native, output: "  exact\n", response: "" });
    const legacy = new OpenClawApiClient({ baseUrl: "http://gateway.test", rpcClient });
    expect(await legacy.getRun("run")).toMatchObject({ status: native, output: "exact" });
  });

  it.each(["aborted", "stop", "rpc", "restart", "superseded"])(
    "maps stopReason=%s to cancelled in canonical mode",
    async (stopReason) => {
      const rpcClient = { request: async <T>() => ({ status: "ok", stopReason }) as T };
      const client = new OpenClawApiClient({ baseUrl: "http://gateway.test", rpcClient, normalizeRunStatus: true });
      expect(await client.getRun("run")).toMatchObject({ status: "cancelled", provider_status: "ok" });
    },
  );

  it("distinguishes terminal timeout (endedAt or error) from poll timeout in canonical mode", async () => {
    const endedClient = new OpenClawApiClient({
      baseUrl: "http://gateway.test",
      rpcClient: { request: async <T>() => ({ status: "timeout", endedAt: 1700000000 }) as T },
      normalizeRunStatus: true,
    });
    expect(await endedClient.getRun("run")).toMatchObject({ status: "failed", provider_status: "timeout" });

    const errorClient = new OpenClawApiClient({
      baseUrl: "http://gateway.test",
      rpcClient: { request: async <T>() => ({ status: "timeout", error: "deadline exceeded" }) as T },
      normalizeRunStatus: true,
    });
    expect(await errorClient.getRun("run")).toMatchObject({
      status: "failed",
      provider_status: "timeout",
      error: "deadline exceeded",
    });

    const pollClient = new OpenClawApiClient({
      baseUrl: "http://gateway.test",
      rpcClient: { request: async <T>() => ({ status: "timeout" }) as T },
      normalizeRunStatus: true,
    });
    expect(await pollClient.getRun("run")).toMatchObject({ status: "running", provider_status: "timeout" });
  });

  it("falls back to visible terminalReply.text and preserves empty strings in canonical mode", async () => {
    const visibleClient = new OpenClawApiClient({
      baseUrl: "http://gateway.test",
      rpcClient: {
        request: async <T>() =>
          ({ status: "ok", terminalReply: { disposition: "visible", text: "  reply\n" } }) as T,
      },
      normalizeRunStatus: true,
    });
    expect(await visibleClient.getRun("run")).toMatchObject({ status: "completed", output: "  reply\n" });

    const emptyVisibleClient = new OpenClawApiClient({
      baseUrl: "http://gateway.test",
      rpcClient: {
        request: async <T>() =>
          ({ status: "ok", terminalReply: { disposition: "visible", text: "" } }) as T,
      },
      normalizeRunStatus: true,
    });
    expect(await emptyVisibleClient.getRun("run")).toMatchObject({ status: "completed", output: "" });

    const hiddenClient = new OpenClawApiClient({
      baseUrl: "http://gateway.test",
      rpcClient: {
        request: async <T>() =>
          ({ status: "ok", terminalReply: { disposition: "silent", text: "internal" } }) as T,
      },
      normalizeRunStatus: true,
    });
    const hidden = await hiddenClient.getRun("run");
    expect(hidden.output).toBeUndefined();
  });
});

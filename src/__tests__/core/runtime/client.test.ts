import { describe, expect, it } from "vitest";
import { ApiClientErrorCode, getErrorCode } from "../../../core/errors";
import { unsupportedRuntimeSurface } from "../../../core/runtime/client";
import type { RuntimeClient } from "../../../core/runtime/client";
import type { RuntimeRunStatus } from "../../../core/runtime/run";

// A minimal Claude-SDK-shaped client implementing the universal contract.
const claude: RuntimeClient = {
  getRuntimeCapabilities: async () => ({
    providerKind: "claude-sdk",
    supports: { runs: true, streaming: true },
  }),
  startRun: async (body): Promise<RuntimeRunStatus> => ({
    run_id: "msg_1",
    status: "completed",
    output: typeof body.input === "string" ? body.input : "ok",
  }),
  getRun: async (runId) => ({ run_id: runId, status: "completed" }),
  cancelRun: async () => ({ status: "cancelled" }),
};

describe("RuntimeClient contract", () => {
  it("a claude-shaped client satisfies the interface", async () => {
    const status = await claude.startRun({ input: "hi" });
    expect(status.run_id).toBe("msg_1");
    const caps = await claude.getRuntimeCapabilities();
    expect(caps.providerKind).toBe("claude-sdk");
  });

  it("unsupportedRuntimeSurface throws EndpointNotFound", () => {
    try {
      unsupportedRuntimeSurface("claude-sdk", "media");
      throw new Error("should have thrown");
    } catch (error) {
      expect(getErrorCode(error)).toBe(ApiClientErrorCode.EndpointNotFound);
    }
  });
});

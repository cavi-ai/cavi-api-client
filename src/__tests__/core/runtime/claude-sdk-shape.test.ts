// SPEC §2a HARD GATE: a Claude-SDK-shaped provider must type-check against the
// universal contract with ZERO gateway fields reachable on the universal types.
//
// NOTE: this repo does not type-check tests in CI yet (see Plan 1 / CI-finalize
// follow-up). The `@ts-expect-error` directives below are verified by an isolated
// `tsc` pass during Plan 1 and are intended to become a permanent `typecheck:gate`
// guard when CI is wired up.
import { describe, expect, it } from "vitest";
import type { RuntimeClient } from "../../../core/runtime/client";
import type { RuntimeRunStartBody } from "../../../core/runtime/run";
import type { RuntimeProviderModule } from "../../../core/gateway/providers/types";

// 1. A Claude-shaped run body uses only universal fields.
const claudeBody: RuntimeRunStartBody = {
  input: [{ role: "user", content: "Summarize this." }],
  instructions: "You are a precise assistant.",
  model: "claude-opus-4-8",
  tools: [{ name: "search", input_schema: {} }],
  metadata: { trace_id: "t1" },
};

// 2. Gateway-only fields are NOT assignable to the universal body.
//    Each @ts-expect-error fails the (isolated) typecheck if the field leaks in.
// @ts-expect-error session_id is gateway-only
const leak1: RuntimeRunStartBody = { input: "x", session_id: "s1" };
// @ts-expect-error targetProfile is gateway-only
const leak2: RuntimeRunStartBody = { input: "x", targetProfile: "p" };
// @ts-expect-error task_id is gateway-only
const leak3: RuntimeRunStartBody = { input: "x", task_id: "t" };
// @ts-expect-error action is gateway-only
const leak4: RuntimeRunStartBody = { input: "x", action: "deploy" };
void leak1;
void leak2;
void leak3;
void leak4;

// 3. A runtime-only provider module + client for claude-sdk.
const claudeClient: RuntimeClient = {
  getRuntimeCapabilities: async () => ({
    providerKind: "claude-sdk",
    protocolVersion: "2023-06-01",
    auth: { type: "api-key", required: true },
    supports: { runs: true, streaming: true },
  }),
  startRun: async () => ({ run_id: "msg_1", status: "completed", output: "done" }),
  getRun: async (id) => ({ run_id: id, status: "completed" }),
  cancelRun: async () => ({ status: "cancelled" }),
};

const claudeModule: RuntimeProviderModule = {
  kind: "claude-sdk",
  capabilities: { runs: true, streaming: true },
  createApiClient: () => claudeClient,
};

describe("Claude SDK shape — spec §2a acceptance gate", () => {
  it("a runtime-only provider satisfies the universal contract", async () => {
    expect(claudeBody.input).toHaveLength(1);
    expect(claudeModule.kind).toBe("claude-sdk");
    const status = await claudeClient.startRun({ input: "hi" });
    expect(status.run_id).toBe("msg_1");
  });
});

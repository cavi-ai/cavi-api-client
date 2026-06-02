import { describe, expect, it } from "vitest";
import {
  ALL_RUNTIME_CONFORMANCE_CHECKS,
  runRuntimeConformance,
  type RuntimeConformanceContext,
} from "./runtime-conformance";
import type { RuntimeClient } from "../../core/runtime/client";

const compliant: RuntimeClient = {
  getRuntimeCapabilities: async () => ({
    providerKind: "fake",
    supports: { runs: true },
  }),
  startRun: async () => ({ run_id: "r1", status: "completed" }),
};

const brokenNoRunId: RuntimeClient = {
  getRuntimeCapabilities: async () => ({ providerKind: "fake", supports: { runs: true } }),
  startRun: async () => ({ run_id: "", status: "completed" }),
};

const ctx = (client: RuntimeClient): RuntimeConformanceContext => ({
  makeClient: () => client,
  runBody: { input: "hi" },
});

describe("runtime conformance kit (self-test)", () => {
  it("passes every check for a compliant client", async () => {
    const results = await runRuntimeConformance(ctx(compliant), ALL_RUNTIME_CONFORMANCE_CHECKS);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("fails the startRun check when run_id is empty (kit has teeth)", async () => {
    const results = await runRuntimeConformance(ctx(brokenNoRunId), ALL_RUNTIME_CONFORMANCE_CHECKS);
    const startRunCheck = results.find((r) => r.name.includes("run_id"));
    expect(startRunCheck?.ok).toBe(false);
  });
});

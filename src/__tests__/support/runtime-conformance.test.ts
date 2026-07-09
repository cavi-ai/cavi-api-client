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

  it("fails the dryRun check when a provider ignores dryRun and calls the network anyway (kit has teeth)", async () => {
    let calls = 0;
    const ignoresDryRun: RuntimeClient = {
      getRuntimeCapabilities: async () => ({ providerKind: "fake", supports: { runs: true } }),
      startRun: async (body) => {
        calls += 1; // simulates a network call the provider should have skipped
        return { run_id: "r1", status: body.dryRun ? "dry_run" : "completed" };
      },
    };
    const ctxWithInstrumentation: RuntimeConformanceContext = {
      makeClient: () => ignoresDryRun,
      runBody: { input: "hi" },
      makeInstrumentedClient: () => ({ client: ignoresDryRun, callCount: () => calls }),
    };

    const results = await runRuntimeConformance(ctxWithInstrumentation, ALL_RUNTIME_CONFORMANCE_CHECKS);
    const dryRunCheck = results.find((r) => r.name.includes("zero network calls and returns a dry_run status"));
    expect(dryRunCheck?.ok).toBe(false);
  });
});

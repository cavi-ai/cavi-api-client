import { describe, expect, it } from "vitest";
import { inspectCapabilityClientConformance } from "../../testing/capability-client-conformance.js";
import { createCapabilityClient } from "../../contracts/capability-client.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import { PROVIDER_CAPABILITIES } from "../../providers/capability-declarations.js";

const runtime: RuntimeClient = {
  getRuntimeCapabilities: async () => ({ providerKind: "test", supports: {} }),
  startRun: async () => ({ run_id: "r1", status: "started" }),
};

describe("inspectCapabilityClientConformance", () => {
  it("a bare client (no capabilities, no backends) passes: every surface resolves", async () => {
    const client = createCapabilityClient({ providerKind: "codex", runtime });
    const report = await inspectCapabilityClientConformance(client);
    expect(report.ok).toBe(true);
    expect(report.rejections).toEqual([]);
    expect(report.probes.length).toBeGreaterThanOrEqual(19);
    expect(report.probes.every((probe) => probe.resolved)).toBe(true);
  });

  it("reports a rejecting surface", async () => {
    const client = createCapabilityClient({ providerKind: "codex", runtime });
    (client as { getRun: unknown }).getRun = async () => {
      throw new Error("contract violation");
    };
    const report = await inspectCapabilityClientConformance(client);
    expect(report.ok).toBe(false);
    expect(report.rejections.map((r) => r.call)).toContain("getRun");
  });

  it("every declared provider's bare client passes conformance", async () => {
    for (const providerKind of Object.keys(PROVIDER_CAPABILITIES)) {
      const client = createCapabilityClient({ providerKind, runtime });
      const report = await inspectCapabilityClientConformance(client);
      expect(report.ok, `provider "${providerKind}" should conform`).toBe(true);
      expect(report.probes.every((probe) => probe.resolved)).toBe(true);
    }
  });
});

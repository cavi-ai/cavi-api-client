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
    expect(report.probes.length).toBeGreaterThanOrEqual(20);
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

  it("reports a synchronously-throwing surface (probe.run() stays inside the try)", async () => {
    const client = createCapabilityClient({ providerKind: "codex", runtime });
    // A plain (non-async) function that throws SYNCHRONOUSLY on invocation —
    // unlike an `async () => { throw }`, this throw happens before any
    // Promise is ever produced. If the inspector ever called `probe.run()`
    // outside its try/catch, this would blow up the whole inspection instead
    // of landing in `rejections`.
    (client as { getRun: unknown }).getRun = () => {
      throw new Error("sync contract violation");
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

  it("every declared provider passes conformance with its DECLARED capabilities gated on", async () => {
    // fallbackSupports = the provider's own declaration: every gated surface
    // it claims to support now runs the invoke/missing-backend tail (no
    // backend is wired here) instead of short-circuiting on the gate. Every
    // probe must still RESOLVE — ok:false ("no … backend is wired" /
    // "does not implement …"), never reject.
    for (const providerKind of Object.keys(
      PROVIDER_CAPABILITIES,
    ) as (keyof typeof PROVIDER_CAPABILITIES)[]) {
      const client = createCapabilityClient({
        providerKind,
        runtime,
        fallbackSupports: PROVIDER_CAPABILITIES[providerKind],
      });
      const report = await inspectCapabilityClientConformance(client);
      expect(report.ok, `provider "${providerKind}" should conform`).toBe(true);
      expect(report.probes.every((probe) => probe.resolved)).toBe(true);
    }
  });
});

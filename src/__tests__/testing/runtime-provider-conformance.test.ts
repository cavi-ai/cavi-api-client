import { describe, expect, it } from "vitest";
import type { RuntimeClient } from "../../core/runtime/client";
import type { RuntimeProviderModule } from "../../core/runtime/providers/index";
import { inspectRuntimeProviderConformance } from "../../testing/index";

const client = (supports = { runs: true }): RuntimeClient => ({
  getRuntimeCapabilities: async () => ({ providerKind: "acme", supports }),
  startRun: async () => ({ id: "run-1", state: "queued" }),
});

describe("inspectRuntimeProviderConformance", () => {
  it("returns a passing runner-neutral report", async () => {
    const module: RuntimeProviderModule = {
      kind: "acme",
      capabilities: { runs: true },
      createClient: () => client(),
    };
    const report = await inspectRuntimeProviderConformance({
      module,
      clientOptions: { baseUrl: "https://runtime.example" },
    });

    expect(report.valid).toBe(true);
    expect(report.checks.every((check) => check.status !== "fail")).toBe(true);
  });

  it("reports capability identity and method mismatches", async () => {
    const module: RuntimeProviderModule = {
      kind: "expected",
      capabilities: { runs: true, streaming: true, batch: true },
      createClient: () => ({
        ...client({ runs: true }),
        getRuntimeCapabilities: async () => ({ providerKind: "actual", supports: { runs: true } }),
      }),
    };
    const report = await inspectRuntimeProviderConformance({
      module,
      clientOptions: { baseUrl: "https://runtime.example" },
    });

    expect(report.valid).toBe(false);
    expect(report.checks.filter((check) => check.status === "fail").map((check) => check.id)).toEqual(
      expect.arrayContaining(["provider-kind", "capabilities", "streaming-method", "batch-methods"]),
    );
  });
});

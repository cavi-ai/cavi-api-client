import { describe, expect, it } from "vitest";
import type { RuntimeClient } from "../../core/runtime/client";
import type { RuntimeProviderModule } from "../../core/runtime/providers/index";
import { createClaudeProviderModule } from "../../providers/claude/provider-module";
import { createClaudeManagedAgentProviderModule } from "../../providers/claude/managed-agents/provider-module";
import { createCodexProviderModule } from "../../providers/codex/provider-module";
import { createAgyProviderModule } from "../../providers/agy/provider-module";
import { createGeminiProviderModule } from "../../providers/gemini/provider-module";
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
      runLifecycleSemantics: "omit",
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
      expect.arrayContaining([
        "provider-kind",
        "capabilities",
        "streaming-method",
        "streaming-path",
        "batch-methods",
      ]),
    );
  });

  it("accepts gateway subscribe-by-runId as the streaming path", async () => {
    const module: RuntimeProviderModule = {
      kind: "gateway-acme",
      capabilities: { runs: true, streaming: true },
      createClient: () => ({
        getRuntimeCapabilities: async () => ({
          providerKind: "gateway-acme",
          supports: { runs: true, streaming: true },
        }),
        startRun: async () => ({ run_id: "r1", status: "running" }),
        getRun: async () => ({ run_id: "r1", status: "running" }),
        cancelRun: async () => ({ status: "cancelled" }),
      }),
      // GatewayProviderFactories shape — subscribe path without streamRun.
      ...({
        createSseRunEventProvider: () => ({
          subscribe: async () => ({ close: () => undefined }),
        }),
      } as object),
    };
    const report = await inspectRuntimeProviderConformance({
      module,
      clientOptions: { baseUrl: "https://gateway.example" },
      runLifecycleSemantics: "server",
    });

    expect(report.valid).toBe(true);
    expect(report.checks.find((c) => c.id === "streaming-path")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "streaming-method")?.status).toBe("pass");
  });

  it("fails when getRun is present without runLifecycleSemantics", async () => {
    const module: RuntimeProviderModule = {
      kind: "acme",
      capabilities: { runs: true },
      createClient: () => ({
        ...client(),
        getRun: async () => ({ run_id: "x", status: "unknown" }),
      }),
    };
    const report = await inspectRuntimeProviderConformance({
      module,
      clientOptions: { baseUrl: "https://runtime.example" },
    });

    expect(report.valid).toBe(false);
    expect(report.checks.find((c) => c.id === "run-lifecycle-semantics")?.status).toBe("fail");
  });

  it("probes sync-store foreign getRun", async () => {
    const module: RuntimeProviderModule = {
      kind: "acme-sync",
      capabilities: { runs: true },
      createClient: () => ({
        getRuntimeCapabilities: async () => ({
          providerKind: "acme-sync",
          supports: { runs: true },
        }),
        startRun: async () => ({ run_id: "r1", status: "completed" }),
        getRun: async () => ({
          run_id: "foreign",
          status: "unknown",
          error: "not retained",
        }),
        cancelRun: async () => ({ status: "completed" }),
      }),
    };
    const report = await inspectRuntimeProviderConformance({
      module,
      clientOptions: { baseUrl: "https://runtime.example" },
      runLifecycleSemantics: "sync-store",
    });

    expect(report.valid).toBe(true);
    expect(report.checks.find((c) => c.id === "run-lifecycle-sync-store")?.status).toBe("pass");
  });

  describe("wired provider modules", () => {
    it("agy is sync-store + streamRun", async () => {
      const module = createAgyProviderModule({ apiKey: "test-key" });
      const report = await inspectRuntimeProviderConformance({
        module,
        clientOptions: { baseUrl: "https://agy.example" },
        runLifecycleSemantics: "sync-store",
      });

      expect(report.valid).toBe(true);
      expect(report.checks.find((c) => c.id === "provider-kind")?.status).toBe("pass");
      expect(report.checks.find((c) => c.id === "capabilities")?.status).toBe("pass");
      expect(report.checks.find((c) => c.id === "streaming-method")?.status).toBe("pass");
      expect(report.checks.find((c) => c.id === "streaming-path")?.status).toBe("pass");
      expect(report.checks.find((c) => c.id === "run-lifecycle-semantics")?.status).toBe("pass");
      expect(report.checks.find((c) => c.id === "run-lifecycle-sync-store")?.status).toBe("pass");
    });

    it("claude-sdk (Messages) is sync-store + streamRun", async () => {
      const module = createClaudeProviderModule({ apiKey: "test-key" });
      const report = await inspectRuntimeProviderConformance({
        module,
        clientOptions: { baseUrl: "https://api.anthropic.com" },
        runLifecycleSemantics: "sync-store",
      });
      expect(report.valid).toBe(true);
      expect(report.checks.find((c) => c.id === "streaming-path")?.message).toMatch(/streamRun/);
      expect(report.checks.find((c) => c.id === "run-lifecycle-sync-store")?.status).toBe("pass");
    });

    it("gemini is sync-store + streamRun", async () => {
      const module = createGeminiProviderModule({ apiKey: "test-key" });
      const report = await inspectRuntimeProviderConformance({
        module,
        clientOptions: { baseUrl: "https://generativelanguage.googleapis.com" },
        runLifecycleSemantics: "sync-store",
      });
      expect(report.valid).toBe(true);
      expect(report.checks.find((c) => c.id === "run-lifecycle-sync-store")?.status).toBe("pass");
    });

    it("codex-responses is server + streamRun", async () => {
      const module = createCodexProviderModule({ apiKey: "test-key" });
      const report = await inspectRuntimeProviderConformance({
        module,
        clientOptions: { baseUrl: "https://api.openai.com" },
        runLifecycleSemantics: "server",
      });
      expect(report.valid).toBe(true);
      expect(report.checks.find((c) => c.id === "run-lifecycle-sync-store")?.status).toBe("skip");
    });

    it("claude-managed-agents is server + streamRun", async () => {
      const module = createClaudeManagedAgentProviderModule({ apiKey: "test-key" });
      const report = await inspectRuntimeProviderConformance({
        module,
        clientOptions: { baseUrl: "https://api.anthropic.com" },
        runLifecycleSemantics: "server",
      });
      expect(report.valid).toBe(true);
      expect(report.checks.find((c) => c.id === "streaming-method")?.status).toBe("pass");
    });
  });
});

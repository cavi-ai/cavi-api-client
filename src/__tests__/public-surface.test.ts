import { describe, expect, it } from "vitest";

describe("public surface — dropped symbols still reachable via subpaths", () => {
  it("provider clients/modules resolve on ./providers/*", async () => {
    const hermes = await import("../providers/hermes/index");
    const openclaw = await import("../providers/openclaw/index");
    const claude = await import("../providers/claude/index");
    const codex = await import("../providers/codex/index");
    expect(hermes.HERMES_PROVIDER_MODULE).toBeDefined();
    expect(openclaw.OPENCLAW_PROVIDER_MODULE).toBeDefined();
    expect(claude.createClaudeProviderModule).toBeDefined();
    expect(codex.createCodexProviderModule).toBeDefined();
  });

  it("CAVI domain resolves on ./extensions/cavi", async () => {
    const cavi = await import("../extensions/cavi/index");
    expect(cavi.CaviControlApiClient).toBeDefined();
    expect(cavi.createTeamRegistry).toBeDefined();
  });

  it("low-level core primitives resolve on their core subpaths", async () => {
    const http = await import("../core/http/index");
    expect(http.BaseHttpApiClient).toBeDefined();
  });

  it("root keeps the curated stable API", async () => {
    const root = await import("../index");
    expect(root.GatewayApiClient).toBeDefined();
    expect(root.createRuntimeProviderRegistry).toBeDefined();
    expect(root.normalizeTeamManifest).toBeDefined();
    expect(root.apiKeyCredentials).toBeDefined();
    // dropped from root:
    expect((root as Record<string, unknown>).CaviControlApiClient).toBeUndefined();
    expect((root as Record<string, unknown>).HermesApiClient).toBeUndefined();
    expect((root as Record<string, unknown>).BaseHttpApiClient).toBeUndefined();
  });
});

import { describe, expect, expectTypeOf, it } from "vitest";
import {
  CapabilityUnavailable,
  createRuntimeControlExtensionRegistry,
  createRuntimeControlClient,
  defineRuntimeControlExtension,
  withRuntimeControlExtensions,
  type RuntimeControlExtensionDescriptor,
  type RuntimeControlExtensionRegistry,
  type RuntimeControlClient,
  type RuntimeControlClientOptions,
} from "../index.js";

describe("public surface — dropped symbols still reachable via subpaths", () => {
  it("exports the canonical control-plane factory and unavailable error", () => {
    expect(createRuntimeControlClient).toBeTypeOf("function");
    expectTypeOf<RuntimeControlClient>().toBeObject();
    expectTypeOf<RuntimeControlClientOptions>().toBeObject();
    expect(CapabilityUnavailable).toBeTypeOf("function");
    expect(createRuntimeControlExtensionRegistry).toBeTypeOf("function");
    expect(defineRuntimeControlExtension).toBeTypeOf("function");
    expect(withRuntimeControlExtensions).toBeTypeOf("function");
    expectTypeOf<RuntimeControlExtensionDescriptor<unknown>>().toBeObject();
    expectTypeOf<RuntimeControlExtensionRegistry>().toBeObject();
  });

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

  it("narrow provider entries expose only focused runtime surfaces", async () => {
    const claude = await import("../providers/claude/messages");
    const codex = await import("../providers/codex/runtime");
    const codexFiles = await import("../providers/codex/files-entry");
    const gemini = await import("../providers/gemini/runtime");
    const geminiFiles = await import("../providers/gemini/files-entry");
    const hermes = await import("../providers/hermes/runtime");
    const openclaw = await import("../providers/openclaw/runtime");

    expect(claude.ClaudeApiClient).toBeDefined();
    expect(codex.CodexApiClient).toBeDefined();
    expect(codexFiles.CodexFilesClient).toBeDefined();
    expect(gemini.GeminiApiClient).toBeDefined();
    expect(geminiFiles.GeminiFilesClient).toBeDefined();
    expect(hermes.HERMES_PROVIDER_MODULE).toBeDefined();
    expect(openclaw.OPENCLAW_PROVIDER_MODULE).toBeDefined();
    expect((hermes as Record<string, unknown>).createHermesTeamRegistry).toBeUndefined();
    expect((openclaw as Record<string, unknown>).createOpenClawTeamRegistry).toBeUndefined();
  });

  it("CAVI domain resolves on ./extensions/cavi", async () => {
    const cavi = await import("../extensions/cavi/index");
    expect(cavi.CaviControlApiClient).toBeDefined();
    expect(cavi.createTeamRegistry).toBeDefined();
    expect(cavi.withCaviRuntimeControlProviders).toBeTypeOf("function");
  });

  it("low-level core primitives resolve on their core subpaths", async () => {
    const http = await import("../core/http/index");
    const runtime = await import("../core/runtime/index");
    const runtimeProviders = await import("../core/runtime/providers/index");
    expect(http.BaseHttpApiClient).toBeDefined();
    expect(runtime.CapabilityUnavailable).toBeTypeOf("function");
    expect(runtimeProviders.createRuntimeProviderRegistry).toBeTypeOf("function");
  });

  it("root keeps the curated stable API", async () => {
    const root = await import("../index");
    expect(root.GatewayApiClient).toBeDefined();
    expect(root.createRuntimeControlClient).toBeTypeOf("function");
    const oldFactoryName = ["createRuntime", "ControlPlane"].join("");
    const oldFacadeName = ["CanonicalRuntime", "ControlPlane"].join("");
    expect((root as Record<string, unknown>)[oldFactoryName]).toBeUndefined();
    expect(oldFacadeName in root).toBe(false);
    expect("RuntimeControlClient" in root).toBe(false);
    expect(root.createRuntimeProviderRegistry).toBeDefined();
    expect(root.normalizeTeamManifest).toBeDefined();
    expect(root.apiKeyCredentials).toBeDefined();
    // dropped from root:
    expect((root as Record<string, unknown>).CaviControlApiClient).toBeUndefined();
    expect((root as Record<string, unknown>).HermesApiClient).toBeUndefined();
    expect((root as Record<string, unknown>).BaseHttpApiClient).toBeUndefined();
  });
});

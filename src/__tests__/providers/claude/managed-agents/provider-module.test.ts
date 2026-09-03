import { describe, expect, it } from "vitest";
import { createClaudeManagedAgentProviderModule } from "../../../../providers/claude/managed-agents/provider-module";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";
import type { RuntimeProviderModule } from "../../../../core/gateway/providers/types";

describe("createClaudeManagedAgentProviderModule", () => {
  it("applies call-time runtime HTTP policy and preserves captured defaults", () => {
    const module = createClaudeManagedAgentProviderModule({
      apiKey: "sk-test",
      defaultTimeoutMs: 45_000,
      cache: "force-cache",
      credentials: "same-origin",
    });
    const overridden = module.createClient?.({
      baseUrl: "https://runtime.example",
      defaultTimeoutMs: 0,
      cache: "reload",
      credentials: "include",
    }) as ClaudeManagedAgentClient;
    expect(overridden.defaultTimeoutMs).toBe(0);
    expect(overridden.cache).toBe("reload");
    expect(overridden.credentials).toBe("include");

    const preserved = module.createClient?.({ baseUrl: "https://runtime.example" }) as ClaudeManagedAgentClient;
    expect(preserved.defaultTimeoutMs).toBe(45_000);
    expect(preserved.cache).toBe("force-cache");
    expect(preserved.credentials).toBe("same-origin");

    const defaults = createClaudeManagedAgentProviderModule({ apiKey: "sk-test" });
    const defaultClient = defaults.createClient?.({ baseUrl: "https://runtime.example" }) as ClaudeManagedAgentClient;
    expect(defaultClient.defaultTimeoutMs).toBe(60_000);
  });

  it("builds a distinct claude-managed-agents module declaring runs + streaming", () => {
    const module: RuntimeProviderModule = createClaudeManagedAgentProviderModule({
      apiKey: "sk-test",
    });
    expect(module.kind).toBe("claude-managed-agents");
    expect(module.aliases).toContain("claude-teams");
    expect(module.capabilities?.runs).toBe(true);
    expect(module.capabilities?.streaming).toBe(true);
  });

  it("createApiClient yields a ClaudeManagedAgentClient (config captured)", () => {
    const module = createClaudeManagedAgentProviderModule({
      apiKey: "sk-test",
      agentId: "agent_x",
      environmentId: "env_x",
    });
    const client = module.createApiClient?.({ baseUrl: "https://api.anthropic.com" });
    expect(client).toBeInstanceOf(ClaudeManagedAgentClient);
  });
});

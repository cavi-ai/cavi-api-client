import { describe, expect, it } from "vitest";
import { createClaudeManagedAgentProviderModule } from "../../../../providers/claude/managed-agents/provider-module";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";
import type { RuntimeProviderModule } from "../../../../core/gateway/providers/types";

describe("createClaudeManagedAgentProviderModule", () => {
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

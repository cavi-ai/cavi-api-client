import { describe, expect, it } from "vitest";
import { CLAUDE_PROVIDER_MODULE } from "../../../providers/claude/provider-module";
import { ClaudeApiClient } from "../../../providers/claude/client";
import type { RuntimeProviderModule } from "../../../core/gateway/providers/types";

describe("CLAUDE_PROVIDER_MODULE", () => {
  it("is a runtime-only provider module declaring runs + streaming", () => {
    const module: RuntimeProviderModule = CLAUDE_PROVIDER_MODULE;
    expect(module.kind).toBe("claude-sdk");
    expect(module.capabilities?.runs).toBe(true);
    expect(module.capabilities?.streaming).toBe(true);
  });

  it("creates a ClaudeApiClient (note: requires apiKey via options)", () => {
    const client = CLAUDE_PROVIDER_MODULE.createApiClient?.({ apiKey: "sk-test" });
    expect(client).toBeInstanceOf(ClaudeApiClient);
  });
});

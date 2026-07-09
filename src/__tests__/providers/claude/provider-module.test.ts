import { describe, expect, it } from "vitest";
import { createClaudeProviderModule } from "../../../providers/claude/provider-module";
import { ClaudeApiClient } from "../../../providers/claude/client";
import type { RuntimeProviderModule } from "../../../core/gateway/providers/types";

describe("createClaudeProviderModule", () => {
  it("builds a runtime-only module declaring runs + streaming + batch", () => {
    const module: RuntimeProviderModule = createClaudeProviderModule({ apiKey: "sk-test" });
    expect(module.kind).toBe("claude-sdk");
    expect(module.capabilities).toEqual({ runs: true, streaming: true, batch: true });
  });

  it("createApiClient yields a ClaudeApiClient (apiKey captured, no cast)", () => {
    const module = createClaudeProviderModule({ apiKey: "sk-test" });
    const client = module.createApiClient?.({ baseUrl: "https://api.anthropic.com" });
    expect(client).toBeInstanceOf(ClaudeApiClient);
  });
});

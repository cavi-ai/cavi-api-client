import { describe, expect, it } from "vitest";
import { createClaudeProviderModule } from "../../../providers/claude/provider-module";
import { ClaudeApiClient } from "../../../providers/claude/client";
import type { RuntimeProviderModule } from "../../../core/gateway/providers/types";

describe("createClaudeProviderModule", () => {
  it("applies call-time runtime HTTP policy over captured configuration", () => {
    const module = createClaudeProviderModule({
      apiKey: "sk-test",
      anthropicVersion: "2023-06-01",
      defaultTimeoutMs: 45_000,
      cache: "force-cache",
      credentials: "same-origin",
    });
    const overridden = module.createClient?.({
      baseUrl: "https://runtime.example",
      defaultTimeoutMs: 0,
      cache: "reload",
      credentials: "include",
    }) as ClaudeApiClient;
    expect(overridden.defaultTimeoutMs).toBe(0);
    expect(overridden.cache).toBe("reload");
    expect(overridden.credentials).toBe("include");
    expect(overridden.defaultHeaders["anthropic-version"]).toBe("2023-06-01");

    const preserved = module.createClient?.({ baseUrl: "https://runtime.example" }) as ClaudeApiClient;
    expect(preserved.defaultTimeoutMs).toBe(45_000);
    expect(preserved.cache).toBe("force-cache");
    expect(preserved.credentials).toBe("same-origin");
  });

  it("builds a runtime-only module declaring every implemented capability", async () => {
    const module: RuntimeProviderModule = createClaudeProviderModule({ apiKey: "sk-test" });
    expect(module.kind).toBe("claude-sdk");
    expect(module.capabilities?.runs).toBe(true);
    expect(module.capabilities?.streaming).toBe(true);
    expect(module.capabilities?.batch).toBe(true);
    const client = module.createClient?.({ baseUrl: "https://api.anthropic.com" });
    expect(module.capabilities).toEqual((await client?.getRuntimeCapabilities()).supports);
  });

  it("createApiClient yields a ClaudeApiClient (apiKey captured, no cast)", () => {
    const module = createClaudeProviderModule({ apiKey: "sk-test" });
    const client = module.createApiClient?.({ baseUrl: "https://api.anthropic.com" });
    expect(client).toBeInstanceOf(ClaudeApiClient);
    expect(module.createClient?.({ baseUrl: "https://api.anthropic.com" })).toBeInstanceOf(
      ClaudeApiClient,
    );
  });
});

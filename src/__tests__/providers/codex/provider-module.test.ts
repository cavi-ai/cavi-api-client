import { describe, expect, it } from "vitest";
import { CodexApiClient } from "../../../providers/codex/client";
import { createCodexProviderModule } from "../../../providers/codex/provider-module";
import type { RuntimeProviderModule } from "../../../core/gateway/providers/types";

describe("createCodexProviderModule", () => {
  it("applies call-time runtime HTTP policy over captured configuration", () => {
    const module = createCodexProviderModule({
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
    }) as CodexApiClient;
    expect(overridden.defaultTimeoutMs).toBe(0);
    expect(overridden.cache).toBe("reload");
    expect(overridden.credentials).toBe("include");
    expect(overridden.resolveAuthHeaders?.()).toEqual({ Authorization: "Bearer sk-test" });

    const preserved = module.createClient?.({ baseUrl: "https://runtime.example" }) as CodexApiClient;
    expect(preserved.defaultTimeoutMs).toBe(45_000);
    expect(preserved.cache).toBe("force-cache");
    expect(preserved.credentials).toBe("same-origin");
  });

  it("builds a runtime-only module declaring every implemented capability", async () => {
    const module: RuntimeProviderModule = createCodexProviderModule({ apiKey: "sk-test" });

    expect(module.kind).toBe("codex-responses");
    expect(module.aliases).toEqual(["codex", "openai-codex"]);
    expect(module.capabilities?.runs).toBe(true);
    expect(module.capabilities?.streaming).toBe(true);
    expect(module.capabilities?.batch).toBe(true);
    const client = module.createClient?.({ baseUrl: "https://api.openai.com" });
    expect(module.capabilities).toEqual((await client?.getRuntimeCapabilities()).supports);
  });

  it("createApiClient yields a CodexApiClient", () => {
    const module = createCodexProviderModule({ apiKey: "sk-test" });
    const client = module.createApiClient?.({ baseUrl: "https://api.openai.com" });

    expect(client).toBeInstanceOf(CodexApiClient);
    expect(module.createClient?.({ baseUrl: "https://api.openai.com" })).toBeInstanceOf(
      CodexApiClient,
    );
  });
});

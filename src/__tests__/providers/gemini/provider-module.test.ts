import { describe, expect, it, vi } from "vitest";
import { createGeminiProviderModule } from "../../../providers/gemini/provider-module";
import { GeminiApiClient } from "../../../providers/gemini/client";

describe("createGeminiProviderModule", () => {
  it("applies call-time runtime HTTP policy over captured configuration", () => {
    const module = createGeminiProviderModule({
      apiKey: "k",
      defaultTimeoutMs: 45_000,
      cache: "force-cache",
      credentials: "same-origin",
    });
    const overridden = module.createClient?.({
      baseUrl: "https://runtime.example",
      defaultTimeoutMs: 0,
      cache: "reload",
      credentials: "include",
    }) as GeminiApiClient;
    expect(overridden.defaultTimeoutMs).toBe(0);
    expect(overridden.cache).toBe("reload");
    expect(overridden.credentials).toBe("include");
    expect(overridden.resolveAuthHeaders?.()).toEqual({ "x-goog-api-key": "k" });

    const preserved = module.createClient?.({ baseUrl: "https://runtime.example" }) as GeminiApiClient;
    expect(preserved.defaultTimeoutMs).toBe(45_000);
    expect(preserved.cache).toBe("force-cache");
    expect(preserved.credentials).toBe("same-origin");
  });

  it("describes a runtime-only gemini module", async () => {
    const module = createGeminiProviderModule({ apiKey: "k" });
    expect(module.kind).toBe("gemini");
    expect(module.aliases).toEqual(["google", "google-gemini"]);
    expect(module.capabilities).toEqual({ runs: true, streaming: true, batch: true });
    const client = module.createClient?.({ baseUrl: "https://proxy.example" });
    expect(module.capabilities).toEqual((await client?.getRuntimeCapabilities()).supports);
  });

  it("createApiClient builds a GeminiApiClient honoring per-call overrides", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const module = createGeminiProviderModule({ apiKey: "k" });
    const client = module.createApiClient({ baseUrl: "https://proxy.example", fetchImpl });
    expect(client).toBeInstanceOf(GeminiApiClient);
  });
});

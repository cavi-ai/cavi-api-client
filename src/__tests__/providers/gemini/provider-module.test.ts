import { describe, expect, it, vi } from "vitest";
import { createGeminiProviderModule } from "../../../providers/gemini/provider-module";
import { GeminiApiClient } from "../../../providers/gemini/client";

describe("createGeminiProviderModule", () => {
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

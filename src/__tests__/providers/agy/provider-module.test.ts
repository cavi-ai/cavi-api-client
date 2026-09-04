import { describe, expect, it } from "vitest";
import { AgyApiClient } from "../../../providers/agy/client";
import { createAgyProviderModule } from "../../../providers/agy/provider-module";

describe("createAgyProviderModule", () => {
  it("declares the agy alias and capabilities", async () => {
    const module = createAgyProviderModule({ apiKey: "agy-key" });

    expect(module.kind).toBe("agy");
    expect(module.aliases).toEqual(["antigravity"]);
    expect(module.capabilities).toEqual({ runs: true, streaming: true });
    const client = module.createClient?.({ baseUrl: "https://runtime.example" });
    expect(client).toBeInstanceOf(AgyApiClient);
    expect(module.capabilities).toEqual((await client?.getRuntimeCapabilities()).supports);
  });

  it("applies call-time runtime HTTP policy over captured configuration", () => {
    const module = createAgyProviderModule({
      apiKey: "agy-key",
      defaultTimeoutMs: 45_000,
      cache: "force-cache",
      credentials: "same-origin",
    });
    const overridden = module.createClient?.({
      baseUrl: "https://runtime.example",
      defaultTimeoutMs: 0,
      cache: "reload",
      credentials: "include",
    }) as AgyApiClient;
    expect(overridden.defaultTimeoutMs).toBe(0);
    expect(overridden.cache).toBe("reload");
    expect(overridden.credentials).toBe("include");
    expect(overridden.resolveAuthHeaders?.()).toEqual({ "x-agy-api-key": "agy-key" });

    const preserved = module.createClient?.({ baseUrl: "https://runtime.example" }) as AgyApiClient;
    expect(preserved.defaultTimeoutMs).toBe(45_000);
    expect(preserved.cache).toBe("force-cache");
    expect(preserved.credentials).toBe("same-origin");
  });
});

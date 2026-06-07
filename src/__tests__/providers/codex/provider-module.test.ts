import { describe, expect, it } from "vitest";
import { CodexApiClient } from "../../../providers/codex/client";
import { createCodexProviderModule } from "../../../providers/codex/provider-module";
import type { RuntimeProviderModule } from "../../../core/gateway/providers/types";

describe("createCodexProviderModule", () => {
  it("builds a runtime-only Codex Responses module declaring runs + streaming", () => {
    const module: RuntimeProviderModule = createCodexProviderModule({ apiKey: "sk-test" });

    expect(module.kind).toBe("codex-responses");
    expect(module.aliases).toEqual(["codex", "openai-codex"]);
    expect(module.capabilities?.runs).toBe(true);
    expect(module.capabilities?.streaming).toBe(true);
  });

  it("createApiClient yields a CodexApiClient", () => {
    const module = createCodexProviderModule({ apiKey: "sk-test" });
    const client = module.createApiClient?.({ baseUrl: "https://api.openai.com" });

    expect(client).toBeInstanceOf(CodexApiClient);
  });
});

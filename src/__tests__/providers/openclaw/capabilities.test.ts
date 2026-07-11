import { describe, expect, it } from "vitest";
import { OpenClawApiClient } from "../../../providers/openclaw/client";
import { OpenClawWikiApiClient } from "../../../providers/openclaw/wiki";
import { ApiClientErrorCode, getErrorCode } from "../../../core/errors";

describe("OpenClawApiClient — runtime capability truthfulness (A2)", () => {
  it("reports wiki:false — the core surface gates every wiki method", async () => {
    const client = new OpenClawApiClient({ baseUrl: "https://gateway.example" });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.supports.wiki).toBe(false);
  });

  it("capability truth: wiki:false <=> every wiki method throws EndpointNotFound", async () => {
    const wiki = new OpenClawWikiApiClient({ baseUrl: "https://gateway.example" });
    let error: unknown;
    try {
      await wiki.listWikiVaults();
    } catch (e) {
      error = e;
    }
    expect(getErrorCode(error)).toBe(ApiClientErrorCode.EndpointNotFound);
  });

  it("reports media:false — most media kinds are gated pre-plugin", async () => {
    const client = new OpenClawApiClient({ baseUrl: "https://gateway.example" });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.supports.media).toBe(false);
  });
});

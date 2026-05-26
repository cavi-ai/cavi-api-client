import { describe, expect, it } from "vitest";
import {
  gatewaySupportsAction,
  gatewaySupportsMediaKind,
  gatewaySupportsRpcMethod,
  gatewaySupportsTextToSpeech,
  normalizeGatewayFeatureCapabilities,
  type GatewayCapabilities,
} from "../../../index";

describe("gateway feature capability normalization", () => {
  it("merges capabilities, endpoints, and media providers into stable feature flags", () => {
    const capabilities = {
      features: {
        media: {
          image: { enabled: true },
          textToSpeech: true,
        },
        actions: [{ id: "media.generate" }],
        rpcMethods: ["chat.send"],
      },
      endpoints: {
        mediaImageGenerate: { method: "POST", path: "/v1/media/image/generate" },
        wikiVaults: { method: "GET", path: "/v1/wiki/vaults" },
        websocket: { method: "GET", path: "/api/ws" },
      },
      commands: ["/help", { command: "agent", description: "Switch agent" }],
    } satisfies GatewayCapabilities;

    const normalized = normalizeGatewayFeatureCapabilities({
      capabilities,
      mediaProviders: {
        providers: [
          { id: "voice-lab", kind: "audio", voices: ["host"] },
          { id: "music-lab", kind: "music", configured: false },
        ],
      },
    });

    expect(normalized).toMatchObject({
      media: true,
      mediaKinds: {
        audio: true,
        image: true,
        video: false,
        music: false,
      },
      textToSpeech: true,
      wiki: true,
      websocket: true,
      rpc: true,
    });
    expect(normalized.commands).toEqual(["/help", "/agent"]);
    expect(gatewaySupportsMediaKind(normalized, "image")).toBe(true);
    expect(gatewaySupportsMediaKind(normalized, "music")).toBe(false);
    expect(gatewaySupportsTextToSpeech(normalized)).toBe(true);
    expect(gatewaySupportsAction(normalized, "media.generate")).toBe(true);
    expect(gatewaySupportsRpcMethod(normalized, "chat.send")).toBe(true);
  });

  it("accepts raw capabilities in support helpers", () => {
    const capabilities = {
      features: {
        media: { audio: true },
        rpcMethods: ["runs.stop"],
      },
    } satisfies GatewayCapabilities;

    expect(gatewaySupportsMediaKind(capabilities, "audio")).toBe(true);
    expect(gatewaySupportsMediaKind(capabilities, "document")).toBe(false);
    expect(gatewaySupportsRpcMethod(capabilities, "runs.stop")).toBe(true);
    expect(gatewaySupportsAction(capabilities, "missing")).toBe(false);
  });

  it("does not infer media from unrelated endpoint substrings", () => {
    const normalized = normalizeGatewayFeatureCapabilities({
      capabilities: {
        features: {},
        endpoints: {
          immediateStatus: { method: "GET", path: "/ready" },
        },
      },
    });

    expect(normalized.media).toBe(false);
    expect(normalized.mediaKinds.image).toBe(false);
  });
});

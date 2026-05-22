import { describe, expect, it, vi } from "vitest";
import {
  GatewayAgentConfigApiClient,
  agentProfileConfigSourcePath,
  buildAgentConfigFromConfigSnapshot,
  buildAgentProfileConfigPatchBody,
} from "../../../core/gateway/agent-config";

describe("gateway agent config client", () => {
  it("uses provider-neutral source paths for generic config snapshots", () => {
    const config = buildAgentConfigFromConfigSnapshot({
      agentId: "default",
      config: { model: { default: "gpt-5" } },
      schema: {
        fields: {
          "model.default": {
            type: "string",
            category: "model",
            description: "Default model",
          },
        },
      },
      fetchedAt: 123,
    });

    expect(agentProfileConfigSourcePath("default")).toBe("profiles/default/config.yaml");
    expect(config.sourcePath).toBe("profiles/default/config.yaml");
    expect(config.sections.map((section) => section.id)).toEqual(["profile", "model"]);
    expect(buildAgentProfileConfigPatchBody({
      agentId: "writer",
      diff: { "model.default": "gpt-5" },
    }).sourcePath).toBe("profiles/writer/config.yaml");
  });

  it("does not fall back to provider-specific WebUI routes from core", async () => {
    const paths: string[] = [];
    const fetchImpl = vi.fn(async (input) => {
      paths.push(new URL(String(input)).pathname);
      return new Response("missing", { status: 404 });
    }) as typeof fetch;
    const client = new GatewayAgentConfigApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl,
    });

    await expect(client.getProfileConfig("default")).rejects.toMatchObject({
      status: 404,
      path: "/api/agent-configs/default/config",
    });
    expect(paths).toEqual(["/api/agent-configs/default/config"]);
  });
});

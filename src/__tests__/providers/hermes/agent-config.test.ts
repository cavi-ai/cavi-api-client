import { describe, expect, it, vi } from "vitest";
import {
  HERMES_PROFILE_COOKIE_NAME,
  HermesAgentConfigApiClient,
  buildAgentConfigFromHermesConfigSnapshot,
  buildAgentConfigFromHermesWebuiSnapshot,
  hermesAgentProfileConfigYamlPath,
  hermesProfileCookieHeader,
} from "../../../providers/hermes/agent-config";
import type {
  AgentConfig,
  AgentConfigField,
} from "../../../core/gateway/agent/config";

function fieldsByKey(config: AgentConfig): Map<string, AgentConfigField> {
  return new Map(config.sections.flatMap((section) =>
    section.fields.map((field) => [field.key, field] as const),
  ));
}

describe("Hermes agent config client", () => {
  it("owns Hermes source paths and WebUI fallback headers", async () => {
    const calls: { path: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push({ path, init });
      if (path === "/api/agent-configs/default/config") {
        return new Response("missing", { status: 404 });
      }
      if (path === "/api/profiles") {
        return Response.json({
          profiles: [{ name: "default", path: "~/.hermes/config.yaml" }],
        });
      }
      if (path === "/api/config") {
        return Response.json({ model: { default: "gpt-5" } });
      }
      if (path === "/api/config/schema") {
        return Response.json({
          fields: {
            "model.default": {
              type: "string",
              category: "model",
              description: "Default model",
            },
          },
        });
      }
      if (path === "/api/config/defaults") {
        return Response.json({});
      }
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;
    const client = new HermesAgentConfigApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl,
    });

    const config = await client.getProfileConfig("default");

    expect(HERMES_PROFILE_COOKIE_NAME).toBe("hermes_profile");
    expect(hermesAgentProfileConfigYamlPath("writer")).toBe(
      "~/.hermes/profiles/writer/config.yaml",
    );
    expect(hermesProfileCookieHeader(" default ")).toBe("hermes_profile=default");
    expect(config.sourcePath).toBe("~/.hermes/config.yaml");
    expect(calls.map((call) => call.path)).toEqual([
      "/api/agent-configs/default/config",
      "/api/profiles",
      "/api/config",
      "/api/config/schema",
      "/api/config/defaults",
    ]);
    expect(calls.slice(2).map((call) =>
      (call.init?.headers as Record<string, string>).Cookie,
    )).toEqual([
      "hermes_profile=default",
      "hermes_profile=default",
      "hermes_profile=default",
    ]);
  });

  it("keeps Hermes compatibility builders out of core", () => {
    const config = buildAgentConfigFromHermesConfigSnapshot({
      agentId: "default",
      config: { model: { default: "gpt-5" } },
      fetchedAt: 123,
    });

    expect(config.sourcePath).toBe("~/.hermes/config.yaml");
  });

  it("synthesizes Hermes WebUI config from model, reasoning, and MCP snapshots", () => {
    const config = buildAgentConfigFromHermesWebuiSnapshot({
      agentId: "writer",
      profiles: {
        profiles: [
          {
            name: "writer",
            path: "~/.hermes/profiles/writer",
            is_active: true,
            model: "gpt-5",
            provider: "openai",
          },
        ],
      },
      models: {
        default_model: " gpt-5 ",
        active_provider: " openai ",
        groups: [
          {
            models: [
              { id: "gpt-5", label: "GPT-5" },
              { value: "claude-sonnet-4", name: "Claude Sonnet 4" },
            ],
          },
        ],
      },
      reasoning: {
        reasoning_effort: " high ",
        show_reasoning: true,
      },
      mcpServers: {
        servers: [
          " filesystem ",
          { name: "github" },
          { id: "browser" },
          {},
          null,
        ],
      },
      fetchedAt: 456,
    });

    const fields = fieldsByKey(config);

    expect(config.agentId).toBe("writer");
    expect(config.sourcePath).toBe("~/.hermes/profiles/writer/config.yaml");
    expect(fields.get("model.default")?.value).toBe("gpt-5");
    expect(fields.get("model.default")?.kind).toEqual({
      type: "select",
      options: [
        { value: "gpt-5", label: "GPT-5" },
        { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
      ],
    });
    expect(fields.get("model.provider")?.value).toBe("openai");
    expect(fields.get("agent.reasoning_effort")?.value).toBe("high");
    expect(fields.get("agent.reasoning_effort")?.kind).toMatchObject({
      type: "select",
    });
    expect(fields.get("display.show_reasoning")?.value).toBe(true);
    expect(fields.get("display.show_reasoning")?.kind).toEqual({ type: "toggle" });
    expect(fields.get("mcp_servers.enabled")?.value).toEqual([
      "filesystem",
      "github",
      "browser",
    ]);
    expect(fields.get("mcp_servers.enabled")?.kind).toEqual({
      type: "list",
      placeholder: "comma-separated values",
    });
  });
});

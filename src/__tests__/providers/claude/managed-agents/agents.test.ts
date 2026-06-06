import { describe, expect, it, vi } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("ClaudeManagedAgentClient control plane", () => {
  it("createAgent posts a flat agent body (model/system/tools/mcp_servers/skills)", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "agent_1", version: 7 })) as unknown as typeof fetch;
    const client = new ClaudeManagedAgentClient({ apiKey: "sk-test", fetchImpl });

    const agent = await client.createAgent({
      name: "Reviewer",
      model: "claude-opus-4-8",
      system: "Review code.",
      tools: [{ type: "agent_toolset_20260401" }],
      mcpServers: [{ type: "url", name: "github", url: "https://api.githubcopilot.com/mcp/" }],
      skills: [{ type: "anthropic", skill_id: "pdf" }],
    });

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toBe("https://api.anthropic.com/v1/agents");
    expect((call[1] as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      name: "Reviewer",
      model: "claude-opus-4-8",
      system: "Review code.",
      tools: [{ type: "agent_toolset_20260401" }],
      mcp_servers: [{ type: "url", name: "github", url: "https://api.githubcopilot.com/mcp/" }],
      skills: [{ type: "anthropic", skill_id: "pdf" }],
    });
    expect(agent).toMatchObject({ id: "agent_1", version: 7 });
  });

  it("createEnvironment defaults to a cloud/unrestricted config", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "env_1" })) as unknown as typeof fetch;
    const client = new ClaudeManagedAgentClient({ apiKey: "sk-test", fetchImpl });

    await client.createEnvironment({ name: "default" });

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toBe("https://api.anthropic.com/v1/environments");
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      name: "default",
      config: { type: "cloud", networking: { type: "unrestricted" } },
    });
  });
});

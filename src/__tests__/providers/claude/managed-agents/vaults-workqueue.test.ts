import { describe, expect, it, vi } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function client() {
  const fetchImpl = vi.fn(async (url: unknown) => {
    if (String(url).includes("/work/stats")) return json({ type: "work_queue_stats", depth: 0, pending: 0, workers_polling: 0 });
    return json({ id: "vlt_1", data: [{ id: "vlt_1" }] });
  }) as unknown as typeof fetch;
  return { c: new ClaudeManagedAgentClient({ apiKey: "sk-test", fetchImpl }), fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}
const lastCall = (f: ReturnType<typeof vi.fn>) => f.mock.calls.at(-1)!;
const lastUrl = (f: ReturnType<typeof vi.fn>) => String(lastCall(f)[0]);
const lastBody = (f: ReturnType<typeof vi.fn>) => JSON.parse(String((lastCall(f)[1] as RequestInit).body));
const lastMethod = (f: ReturnType<typeof vi.fn>) => (lastCall(f)[1] as RequestInit).method;

describe("ClaudeManagedAgentClient — vaults & credentials", () => {
  it("createVault posts display_name (verified live, not `name`)", async () => {
    const { c, fetchImpl } = client();
    await c.createVault({ displayName: "Alice", metadata: { external_user_id: "u1" } });
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/vaults");
    expect(lastBody(fetchImpl)).toEqual({ display_name: "Alice", metadata: { external_user_id: "u1" } });
  });

  it("createCredential posts the auth object (static_bearer)", async () => {
    const { c, fetchImpl } = client();
    await c.createCredential("vlt_1", {
      displayName: "Linear",
      auth: { type: "static_bearer", mcp_server_url: "https://mcp.linear.app/mcp", token: "lin_x" },
    });
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/vaults/vlt_1/credentials");
    expect(lastBody(fetchImpl)).toEqual({
      display_name: "Linear",
      auth: { type: "static_bearer", mcp_server_url: "https://mcp.linear.app/mcp", token: "lin_x" },
    });
  });

  it("updateCredential rotates via POST; validateMcpOauthCredential POSTs the validate path", async () => {
    const { c, fetchImpl } = client();
    await c.updateCredential("vlt_1", "vcrd_1", { auth: { type: "mcp_oauth", access_token: "new" } });
    expect(lastMethod(fetchImpl)).toBe("POST");
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/vaults/vlt_1/credentials/vcrd_1");

    await c.validateMcpOauthCredential("vlt_1", "vcrd_1");
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/vaults/vlt_1/credentials/vcrd_1/mcp_oauth_validate");
    expect(lastMethod(fetchImpl)).toBe("POST");
  });

  it("listVaults appends include_archived", async () => {
    const { c, fetchImpl } = client();
    await c.listVaults(true);
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/vaults?include_archived=true");
  });
});

describe("ClaudeManagedAgentClient — self-hosted work queue", () => {
  it("getWorkQueueStats / stopWork hit the work endpoints", async () => {
    const { c, fetchImpl } = client();
    const stats = await c.getWorkQueueStats("env_1");
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/environments/env_1/work/stats");
    expect(stats.type).toBe("work_queue_stats");

    await c.stopWork("env_1", "work_9");
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/environments/env_1/work/work_9/stop");
    expect(lastMethod(fetchImpl)).toBe("POST");
  });
});

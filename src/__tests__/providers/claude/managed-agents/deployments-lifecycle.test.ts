import { describe, expect, it, vi } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function client() {
  const fetchImpl = vi.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes("/deployment_runs")) return json({ id: "drun_1", data: [{ id: "drun_1" }] });
    if (u.includes("/deployments")) return json({ id: "depl_1", status: "active" });
    if (u.includes("/resources")) return json({ id: "res_1", data: [{ id: "res_1", type: "file" }] });
    if (u.includes("/versions")) return json({ data: [{ id: "agent_1", version: 3 }] });
    if (u.includes("/agents")) return json({ id: "agent_1", data: [{ id: "agent_1" }] });
    if (u.includes("/environments")) return json({ id: "env_1", data: [{ id: "env_1" }] });
    if (u.includes("/sessions")) return json({ id: "sesn_1", data: [{ id: "sesn_1" }] });
    return json({});
  }) as unknown as typeof fetch;
  return { c: new ClaudeManagedAgentClient({ apiKey: "sk-test", fetchImpl }), fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

function lastCall(fetchImpl: ReturnType<typeof vi.fn>) {
  const call = fetchImpl.mock.calls.at(-1)!;
  const init = (call[1] as RequestInit) ?? {};
  return {
    url: String(call[0]),
    method: init.method ?? "GET",
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

describe("ClaudeManagedAgentClient — scheduled deployments", () => {
  it("createDeployment posts agent ref, initial_events, and schedule", async () => {
    const { c, fetchImpl } = client();
    await c.createDeployment({
      name: "Weekly scan",
      agentId: "agent_1",
      agentVersion: 3,
      environmentId: "env_1",
      initialEvents: [{ type: "user.message", content: [{ type: "text", text: "go" }] }],
      schedule: { type: "cron", expression: "0 20 * * 5", timezone: "America/New_York" },
    });
    const { url, method, body } = lastCall(fetchImpl);
    expect(url).toBe("https://api.anthropic.com/v1/deployments");
    expect(method).toBe("POST");
    expect(body).toEqual({
      name: "Weekly scan",
      agent: { type: "agent", id: "agent_1", version: 3 },
      environment_id: "env_1",
      initial_events: [{ type: "user.message", content: [{ type: "text", text: "go" }] }],
      schedule: { type: "cron", expression: "0 20 * * 5", timezone: "America/New_York" },
    });
  });

  it("pause / unpause / archive / run hit the right action paths", async () => {
    const { c, fetchImpl } = client();
    await c.pauseDeployment("depl_1");
    expect(lastCall(fetchImpl)).toMatchObject({ url: expect.stringContaining("/v1/deployments/depl_1/pause"), method: "POST" });
    await c.unpauseDeployment("depl_1");
    expect(lastCall(fetchImpl)).toMatchObject({ url: expect.stringContaining("/v1/deployments/depl_1/unpause"), method: "POST" });
    await c.archiveDeployment("depl_1");
    expect(lastCall(fetchImpl)).toMatchObject({ url: expect.stringContaining("/v1/deployments/depl_1/archive"), method: "POST" });
    await c.runDeployment("depl_1");
    expect(lastCall(fetchImpl)).toMatchObject({ url: expect.stringContaining("/v1/deployments/depl_1/run"), method: "POST" });
  });

  it("listDeploymentRuns filters by deployment_id and has_error; getDeploymentRun by id", async () => {
    const { c, fetchImpl } = client();
    await c.listDeploymentRuns("depl_1", { hasError: true });
    const list = lastCall(fetchImpl);
    expect(list.url).toContain("/v1/deployment_runs?");
    expect(list.url).toContain("deployment_id=depl_1");
    expect(list.url).toContain("has_error=true");

    await c.getDeploymentRun("drun_1");
    expect(lastCall(fetchImpl).url).toBe("https://api.anthropic.com/v1/deployment_runs/drun_1");
  });
});

describe("ClaudeManagedAgentClient — agent / environment / session lifecycle", () => {
  it("agent list / versions / archive", async () => {
    const { c, fetchImpl } = client();
    await c.listAgentVersions("agent_1");
    expect(lastCall(fetchImpl).url).toBe("https://api.anthropic.com/v1/agents/agent_1/versions");
    await c.archiveAgent("agent_1");
    expect(lastCall(fetchImpl)).toMatchObject({ url: expect.stringContaining("/v1/agents/agent_1/archive"), method: "POST" });
  });

  it("environment update / delete / archive", async () => {
    const { c, fetchImpl } = client();
    await c.updateEnvironment("env_1", { name: "renamed" });
    expect(lastCall(fetchImpl)).toMatchObject({ url: expect.stringContaining("/v1/environments/env_1"), method: "POST", body: { name: "renamed" } });
    await c.deleteEnvironment("env_1");
    expect(lastCall(fetchImpl).method).toBe("DELETE");
    await c.archiveEnvironment("env_1");
    expect(lastCall(fetchImpl).url).toContain("/v1/environments/env_1/archive");
  });

  it("session update posts session-local override; delete is DELETE", async () => {
    const { c, fetchImpl } = client();
    await c.updateSession("sesn_1", {
      title: "t",
      agent: { tools: [{ type: "agent_toolset_20260401" }] },
      vaultIds: ["vlt_1"],
    });
    expect(lastCall(fetchImpl)).toMatchObject({
      method: "POST",
      body: { title: "t", agent: { tools: [{ type: "agent_toolset_20260401" }] }, vault_ids: ["vlt_1"] },
    });
    await c.deleteSession("sesn_1");
    expect(lastCall(fetchImpl).method).toBe("DELETE");
  });
});

describe("ClaudeManagedAgentClient — session resources", () => {
  it("addResource posts the resource; updateResource rotates the token; delete removes it", async () => {
    const { c, fetchImpl } = client();
    await c.addResource("sesn_1", { type: "github_repository", url: "https://github.com/o/r", authorization_token: "ghp_x" });
    expect(lastCall(fetchImpl)).toMatchObject({ url: expect.stringContaining("/v1/sessions/sesn_1/resources"), method: "POST" });

    await c.updateResource("sesn_1", "res_1", { authorization_token: "ghp_rotated" });
    expect(lastCall(fetchImpl)).toMatchObject({
      url: expect.stringContaining("/v1/sessions/sesn_1/resources/res_1"),
      method: "POST",
      body: { authorization_token: "ghp_rotated" },
    });

    await c.deleteResource("sesn_1", "res_1");
    expect(lastCall(fetchImpl).method).toBe("DELETE");
  });
});

describe("ClaudeManagedAgentClient — session agent references", () => {
  it("createSession sends a bare id by default, a pinned ref with agentVersion, and overrides", async () => {
    const { c, fetchImpl } = client();
    await c.createSession({ agentId: "agent_1", environmentId: "env_1" });
    expect(lastCall(fetchImpl).body).toMatchObject({ agent: "agent_1", environment_id: "env_1" });

    await c.createSession({ agentId: "agent_1", agentVersion: 4, environmentId: "env_1" });
    expect(lastCall(fetchImpl).body).toMatchObject({ agent: { type: "agent", id: "agent_1", version: 4 } });

    await c.createSession({
      agentId: "agent_1",
      agentOverrides: { model: "claude-opus-4-8", system: null },
      environmentId: "env_1",
    });
    expect(lastCall(fetchImpl).body).toMatchObject({
      agent: { type: "agent_with_overrides", id: "agent_1", model: "claude-opus-4-8", system: null },
    });
  });
});

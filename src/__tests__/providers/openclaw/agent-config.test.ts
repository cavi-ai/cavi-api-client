import { describe, expect, it, vi } from "vitest";
import {
  OpenClawAgentConfigApiClient,
  normalizeOpenClawAgentProfiles,
} from "../../../providers/openclaw/agent-config.js";
import { ApiClientErrorCode } from "../../../core/errors.js";

// Captured verbatim from a live OpenClaw gateway (2026-07-23).
const LIVE_AGENTS_LIST = {
  defaultId: "tony",
  mainKey: "main",
  scope: "per-sender",
  agents: [
    { id: "tony", name: "Tony", workspace: "/teams/front-door/ws", agentRuntime: { id: "auto", source: "implicit" } },
    { id: "scout", name: "Scout", workspace: "/teams/research/ws", agentRuntime: { id: "codex", source: "model" } },
  ],
};

describe("normalizeOpenClawAgentProfiles", () => {
  it("maps the live agents.list payload to profile summaries", () => {
    expect(normalizeOpenClawAgentProfiles(LIVE_AGENTS_LIST)).toEqual([
      { agentId: "tony", agentName: "Tony", sourcePath: "/teams/front-door/ws", isDefault: true, model: "auto", provider: null },
      { agentId: "scout", agentName: "Scout", sourcePath: "/teams/research/ws", isDefault: false, model: "codex", provider: null },
    ]);
  });

  it("tolerates a malformed/empty payload without throwing", () => {
    expect(normalizeOpenClawAgentProfiles(null)).toEqual([]);
    expect(normalizeOpenClawAgentProfiles({ agents: [{ name: "no-id" }] })).toEqual([]);
  });
});

describe("OpenClawAgentConfigApiClient.listProfiles", () => {
  it("dispatches agents.list over the injected rpc and maps the result", async () => {
    const request = vi.fn(async () => LIVE_AGENTS_LIST);
    const client = new OpenClawAgentConfigApiClient({
      baseUrl: "http://gw.test",
      rpcClient: { request } as never,
    });
    const profiles = await client.listProfiles();
    expect(request).toHaveBeenCalledWith("agents.list", {});
    expect(profiles.map((p) => p.agentId)).toEqual(["tony", "scout"]);
  });

  it("stays gated (EndpointNotFound) when no rpc client is wired", async () => {
    const client = new OpenClawAgentConfigApiClient({ baseUrl: "http://gw.test" });
    await expect(client.listProfiles()).rejects.toMatchObject({ code: ApiClientErrorCode.EndpointNotFound });
  });
});

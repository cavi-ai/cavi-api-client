import { describe, expect, it, vi } from "vitest";

import { ApiClientError, ApiClientErrorCode } from "../../../../core/errors.js";
import { createOpenClawControlPlane } from "../../../../providers/openclaw/control-plane/factory.js";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc.js";
import { createOpenClawWorkspaceClient } from "../../../../providers/openclaw/control-plane/workspace.js";

function createRpc(payload: unknown): OpenClawRpc {
  return {
    request: vi.fn(async () => payload),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

const agents = {
  defaultId: "main",
  mainKey: "agent:main",
  scope: "global",
  agents: [{
    id: "main",
    name: "Main",
    identity: { name: "Primary Agent", emoji: "robot" },
    workspace: "/workspace/main",
    workspaceGit: true,
    model: { primary: "provider/model" },
  }],
};

describe("OpenClaw workspace control plane", () => {
  it("lists only explicit agents.list workspace descriptors", async () => {
    const rpc = createRpc(agents);

    const result = await createOpenClawWorkspaceClient(rpc).listWorkspaces();

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("agents.list", {}, { signal: undefined });
    expect(result).toEqual([{
      id: "openclaw-workspace:%2Fworkspace%2Fmain",
      providerId: "/workspace/main",
      displayName: "Main",
      root: "/workspace/main",
      accessMode: "unknown",
      metadata: {
        provider: "openclaw",
        stability: "experimental",
        source: { transport: "websocket", method: "agents.list" },
        providerData: { agentId: "main", identity: { name: "Primary Agent", emoji: "robot" } },
      },
    }]);
    expect(JSON.stringify(result)).not.toContain("provider/model");
  });

  it("does not infer a root from cwd, sessions, environments, or artifacts", async () => {
    const rpc = createRpc({ ...agents, agents: [{ id: "main", name: "Main" }] });

    const result = await createOpenClawWorkspaceClient(rpc).listWorkspaces();
    expect(result).toEqual([]);
  });

  it("deduplicates explicit workspace roots without using agent ids as workspace ids", async () => {
    const rpc = createRpc({ ...agents, agents: [
      { id: "agent-a", workspace: "/workspace/shared" },
      { id: "agent-b", workspace: "/workspace/shared" },
      { id: "agent-c" },
    ] });
    const result = await createOpenClawWorkspaceClient(rpc).listWorkspaces();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "openclaw-workspace:%2Fworkspace%2Fshared",
      providerId: "/workspace/shared",
      root: "/workspace/shared",
      metadata: { providerData: { agentId: "agent-a" } },
    });
  });

  it("gets with one agents.list call and a local lookup", async () => {
    const rpc = createRpc(agents);

    const result = await createOpenClawWorkspaceClient(rpc).getWorkspace("openclaw-workspace:%2Fworkspace%2Fmain");

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("agents.list", {}, { signal: undefined });
    expect(result).toMatchObject({ id: "openclaw-workspace:%2Fworkspace%2Fmain", root: "/workspace/main" });
  });

  it("throws the canonical typed not-found error after one agents.list call", async () => {
    const rpc = createRpc(agents);

    await expect(createOpenClawWorkspaceClient(rpc).getWorkspace("missing")).rejects.toMatchObject<ApiClientError>({
      name: "ApiClientError",
      code: ApiClientErrorCode.EndpointNotFound,
    });
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it("is wired by the internal factory without capability promotion", async () => {
    const rpc = createRpc(agents);
    const plane = await createOpenClawControlPlane({ rpc });

    await expect(plane.workspace.getWorkspace("openclaw-workspace:%2Fworkspace%2Fmain")).resolves.toMatchObject({ root: "/workspace/main" });
  });
});

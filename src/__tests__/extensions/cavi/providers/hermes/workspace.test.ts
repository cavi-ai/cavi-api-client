import { describe, expect, it, vi } from "vitest";

import type { CaviControlAdapters } from "../../../../../extensions/cavi/adapters/create-cavi-control-adapters.js";
import { createHermesCaviWorkspaceClient } from "../../../../../extensions/cavi/providers/hermes/workspace.js";

function adapters(params: { projectBoard?: unknown; operator?: unknown; operatorTransport?: "websocket" | "http" }): CaviControlAdapters {
  return {
    loadProjectBoardWorkspace: vi.fn(async () => ({
      data: params.projectBoard, source: "gateway", fetchedAt: 1, contractGaps: [],
    })),
    loadOperatorControl: vi.fn(async () => ({
      data: params.operator, source: "gateway", fetchedAt: 1, contractGaps: [], transports: { tasks: params.operatorTransport ?? "websocket", registryDetail: params.operatorTransport ?? "websocket" },
    })),
  } as unknown as CaviControlAdapters;
}

describe("Hermes CAVI workspace composition", () => {
  it("maps only explicit workspace identity descriptors", async () => {
    const client = createHermesCaviWorkspaceClient(adapters({
      projectBoard: {
        workspaceIdentity: { id: "project-board", displayName: "Project Board", root: "/work/project", accessMode: "read-write" },
        profile: { name: "Project Board" },
      },
      operator: {
        registryDetail: { agents: [{
          id: "operator", repos: ["/work/operator"],
          workspaceIdentity: { id: "operator-control", displayName: "Operator Control", accessMode: "read-only" },
        }] },
      },
    }));

    await expect(client.listWorkspaces()).resolves.toEqual([
      {
        id: "hermes-cavi-workspace:project-board", providerId: "project-board",
        displayName: "Project Board", root: "/work/project", accessMode: "read-write",
        metadata: { provider: "hermes", stability: "experimental", source: { transport: "http", method: "project-board.workspace" } },
      },
      {
        id: "hermes-cavi-workspace:operator-control", providerId: "operator-control",
        displayName: "Operator Control", accessMode: "read-only",
        metadata: { provider: "hermes", stability: "experimental", source: { transport: "websocket", method: "operator.registry" }, providerData: { agentId: "operator" } },
      },
    ]);
  });

  it("reports HTTP provenance for operator workspace identities loaded by HTTP fallback", async () => {
    const client = createHermesCaviWorkspaceClient(adapters({
      projectBoard: {}, operatorTransport: "http",
      operator: { registryDetail: { agents: [{
        id: "operator", workspaceIdentity: { id: "operator-control", accessMode: "read-only" },
      }] } },
    }));
    await expect(client.listWorkspaces()).resolves.toMatchObject([{
      metadata: { source: { transport: "http", method: "operator.registry" } },
    }]);
  });

  it("fails closed for registry-only fallback inside a partial gateway envelope", async () => {
    const source = adapters({
      projectBoard: {}, operator: { registryDetail: { agents: [{
        id: "operator", workspaceIdentity: { id: "local", accessMode: "read-only" },
      }] } },
    });
    vi.mocked(source.loadOperatorControl).mockResolvedValueOnce({
      data: { registryDetail: { agents: [{ id: "operator", workspaceIdentity: { id: "local", accessMode: "read-only" } }] } },
      source: "gateway", fetchedAt: 1, contractGaps: [],
      transports: { tasks: "websocket", registryDetail: "fallback" },
    } as never);
    await expect(createHermesCaviWorkspaceClient(source).listWorkspaces())
      .rejects.toThrow(/^Hermes CAVI workspace response failed schema validation$/u);
  });

  it("does not promote config, repo paths, portal IDs, or team IDs without workspace identity", async () => {
    const client = createHermesCaviWorkspaceClient(adapters({
      projectBoard: { profile: { name: "Project Board", photoPath: "/config/project.json" }, configPath: "/config/cavi.json" },
      operator: { registryDetail: {
        sourcePath: "/config/operator.json",
        agents: [{ id: "operator", repos: ["/work/operator"], teams: ["engineering"] }],
        teams: [{ id: "engineering", portalId: "eng", teamSlug: "engineering" }],
      } },
    }));
    await expect(client.listWorkspaces()).resolves.toEqual([]);
    await expect(client.getWorkspace("/work/operator")).rejects.toThrow(/not found/i);
  });

  it("deduplicates identical explicit identities across and within sources", async () => {
    const identity = { id: "shared", displayName: "Shared", root: "/work/shared", accessMode: "read-only" };
    const client = createHermesCaviWorkspaceClient(adapters({
      projectBoard: { workspaceIdentity: { ...identity } },
      operator: { registryDetail: { agents: [
        { id: "a", workspaceIdentity: { ...identity } },
        { id: "b", workspaceIdentity: { ...identity } },
      ] } },
    }));
    await expect(client.listWorkspaces()).resolves.toHaveLength(1);
  });

  it.each([
    ["same source", undefined],
    ["cross source", { id: "shared", displayName: "Shared", root: "/work/a", accessMode: "read-only" }],
  ])("fails closed on %s workspace identity conflicts", async (label, projectIdentity) => {
    const secondIdentity = {
      id: "shared", displayName: "Shared", root: "/work/b", accessMode: "read-write",
    };
    const firstIdentity = label === "cross source" ? secondIdentity : {
      id: "shared", displayName: "Shared", root: "/work/a", accessMode: "read-only",
    };
    const client = createHermesCaviWorkspaceClient(adapters({
      projectBoard: projectIdentity === undefined ? {} : { workspaceIdentity: projectIdentity },
      operator: { registryDetail: { agents: [
        { id: "a", workspaceIdentity: firstIdentity },
        { id: "b", workspaceIdentity: secondIdentity },
      ] } },
    }));
    await expect(client.listWorkspaces()).rejects.toThrow(
      /^Hermes CAVI workspace response failed schema validation$/u,
    );
  });

  it("rejects unsafe descriptors and arrays without invoking getters", async () => {
    const getter = vi.fn(() => ({ id: "unsafe", accessMode: "read-write" }));
    const agent = { id: "operator" };
    Object.defineProperty(agent, "workspaceIdentity", { enumerable: true, get: getter });
    const agents = [agent];
    Object.defineProperty(agents, "extra", { enumerable: true, value: true });
    const client = createHermesCaviWorkspaceClient(adapters({
      projectBoard: {}, operator: { registryDetail: { agents } },
    }));
    await expect(client.listWorkspaces()).rejects.toThrow(/schema validation/u);
    expect(getter).not.toHaveBeenCalled();
  });
});

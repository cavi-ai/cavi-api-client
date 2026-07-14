import { describe, expect, it, vi } from "vitest";

import type { CaviControlAdapters } from "../../../../../extensions/cavi/adapters/create-cavi-control-adapters.js";
import { createHermesCaviWorkspaceClient } from "../../../../../extensions/cavi/providers/hermes/workspace.js";

function adapters(params: { projectBoard?: unknown; operator?: unknown }): CaviControlAdapters {
  return {
    loadProjectBoardWorkspace: vi.fn(async () => ({
      data: params.projectBoard, source: "gateway", fetchedAt: 1, contractGaps: [],
    })),
    loadOperatorControl: vi.fn(async () => ({
      data: params.operator, source: "gateway", fetchedAt: 1, contractGaps: [],
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
});

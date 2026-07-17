import { describe, expect, it, vi } from "vitest";

import type { CaviControlAdapters } from "../../../../../extensions/cavi/adapters/create-cavi-control-adapters.js";
import { createHermesCaviWorkspaceClient } from "../../../../../extensions/cavi/providers/hermes/workspace.js";

function adapters(params: { operator?: unknown; operatorTransport?: "websocket" | "http" }): CaviControlAdapters {
  return {
    loadOperatorControl: vi.fn(async () => ({
      data: params.operator, source: "gateway", fetchedAt: 1, contractGaps: [], transports: { tasks: params.operatorTransport ?? "websocket", registryDetail: params.operatorTransport ?? "websocket" },
    })),
  } as unknown as CaviControlAdapters;
}

describe("Hermes CAVI workspace composition", () => {
  it("maps only explicit workspace identity descriptors", async () => {
    const client = createHermesCaviWorkspaceClient(adapters({
      operator: {
        registryDetail: { agents: [{
          id: "operator", repos: ["/work/operator"],
          workspaceIdentity: { id: "operator-control", displayName: "Operator Control", accessMode: "read-only" },
        }] },
      },
    }));

    await expect(client.listWorkspaces()).resolves.toEqual([
      {
        id: "hermes-cavi-workspace:operator-control", providerId: "operator-control",
        displayName: "Operator Control", accessMode: "read-only",
        metadata: { provider: "hermes", stability: "experimental", source: { transport: "websocket", method: "operator.registry" }, providerData: { agentId: "operator" } },
      },
    ]);
  });

  it("reports HTTP provenance for operator workspace identities loaded by HTTP fallback", async () => {
    const client = createHermesCaviWorkspaceClient(adapters({
      operatorTransport: "http",
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
      operator: { registryDetail: { agents: [{
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
      operator: { registryDetail: {
        sourcePath: "/config/operator.json",
        agents: [{ id: "operator", repos: ["/work/operator"], teams: ["engineering"] }],
        teams: [{ id: "engineering", portalId: "eng", teamSlug: "engineering" }],
      } },
    }));
    await expect(client.listWorkspaces()).resolves.toEqual([]);
    await expect(client.getWorkspace("/work/operator")).rejects.toThrow(/not found/i);
  });

  it("deduplicates identical explicit identities within the operator registry", async () => {
    const identity = { id: "shared", displayName: "Shared", root: "/work/shared", accessMode: "read-only" };
    const client = createHermesCaviWorkspaceClient(adapters({
      operator: { registryDetail: { agents: [
        { id: "a", workspaceIdentity: { ...identity } },
        { id: "b", workspaceIdentity: { ...identity } },
      ] } },
    }));
    await expect(client.listWorkspaces()).resolves.toHaveLength(1);
  });

  it("fails closed on workspace identity conflicts", async () => {
    const client = createHermesCaviWorkspaceClient(adapters({
      operator: { registryDetail: { agents: [
        { id: "a", workspaceIdentity: { id: "shared", displayName: "Shared", root: "/work/a", accessMode: "read-only" } },
        { id: "b", workspaceIdentity: { id: "shared", displayName: "Shared", root: "/work/b", accessMode: "read-write" } },
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
      operator: { registryDetail: { agents } },
    }));
    await expect(client.listWorkspaces()).rejects.toThrow(/schema validation/u);
    expect(getter).not.toHaveBeenCalled();
  });
});

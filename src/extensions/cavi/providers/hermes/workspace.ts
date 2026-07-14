import { ApiClientError, ApiClientErrorCode } from "../../../../core/errors.js";
import type { RuntimeControlPlaneMetadata } from "../../../../core/runtime/control-plane/types.js";
import type { RuntimeWorkspaceDescriptor, WorkspaceClient } from "../../../../core/runtime/control-plane/workspace.js";
import type { CaviControlAdapters } from "../../adapters/create-cavi-control-adapters.js";

type ExplicitWorkspaceIdentity = {
  id: string; displayName?: string; root?: string;
  accessMode: RuntimeWorkspaceDescriptor["accessMode"];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function workspaceIdentity(value: unknown): ExplicitWorkspaceIdentity | null {
  const candidate = record(value);
  if (!candidate || typeof candidate.id !== "string" || candidate.id.trim().length === 0) return null;
  if (candidate.accessMode !== "read-only" && candidate.accessMode !== "read-write" && candidate.accessMode !== "unknown") return null;
  if (candidate.displayName !== undefined && typeof candidate.displayName !== "string") return null;
  if (candidate.root !== undefined && typeof candidate.root !== "string") return null;
  return {
    id: candidate.id,
    ...(candidate.displayName === undefined ? {} : { displayName: candidate.displayName }),
    ...(candidate.root === undefined ? {} : { root: candidate.root }),
    accessMode: candidate.accessMode,
  };
}

function mapWorkspace(identity: ExplicitWorkspaceIdentity, method: string, transport: "http" | "websocket", providerData?: Record<string, unknown>): RuntimeWorkspaceDescriptor {
  const metadata: RuntimeControlPlaneMetadata = {
    provider: "hermes", stability: "experimental", source: { transport, method },
    ...(providerData === undefined ? {} : { providerData }),
  };
  return {
    id: `hermes-cavi-workspace:${encodeURIComponent(identity.id)}`, providerId: identity.id,
    ...(identity.displayName === undefined ? {} : { displayName: identity.displayName }),
    ...(identity.root === undefined ? {} : { root: identity.root }),
    accessMode: identity.accessMode, metadata,
  };
}

export function createHermesCaviWorkspaceClient(adapters: CaviControlAdapters): WorkspaceClient {
  const list = async (): Promise<readonly RuntimeWorkspaceDescriptor[]> => {
    const [projectBoard, operator] = await Promise.all([adapters.loadProjectBoardWorkspace(), adapters.loadOperatorControl()]);
    const workspaces: RuntimeWorkspaceDescriptor[] = [];
    const projectIdentity = workspaceIdentity(record(projectBoard.data)?.workspaceIdentity);
    if (projectIdentity) workspaces.push(mapWorkspace(projectIdentity, "project-board.workspace", "http"));
    const registry = record(record(operator.data)?.registryDetail);
    const agents = Array.isArray(registry?.agents) ? registry.agents : [];
    for (const value of agents) {
      const agent = record(value);
      const identity = workspaceIdentity(agent?.workspaceIdentity);
      if (identity) workspaces.push(mapWorkspace(identity, "operator.registry", "websocket", typeof agent?.id === "string" ? { agentId: agent.id } : undefined));
    }
    const seen = new Set<string>();
    return workspaces.filter((workspace) => !seen.has(workspace.providerId) && seen.add(workspace.providerId));
  };
  return {
    listWorkspaces: list,
    async getWorkspace(id: string) {
      const workspace = (await list()).find((candidate) => candidate.id === id || candidate.providerId === id);
      if (!workspace) throw new ApiClientError(`Hermes CAVI workspace not found: ${id}`, { code: ApiClientErrorCode.EndpointNotFound });
      return workspace;
    },
  };
}

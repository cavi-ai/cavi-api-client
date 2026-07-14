import { ApiClientError, ApiClientErrorCode } from "../../../../core/errors.js";
import type { RuntimeControlPlaneMetadata } from "../../../../core/runtime/control-plane/types.js";
import type { RuntimeWorkspaceDescriptor, WorkspaceClient } from "../../../../core/runtime/control-plane/workspace.js";
import type { CaviControlAdapters } from "../../adapters/create-cavi-control-adapters.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";

const WORKSPACE_SCHEMA_ERROR = "Hermes CAVI workspace response failed schema validation";

type ExplicitWorkspaceIdentity = {
  id: string; displayName?: string; root?: string;
  accessMode: RuntimeWorkspaceDescriptor["accessMode"];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeSnapshot(value: unknown): Record<string, unknown> {
  try {
    return requireHermesSafeJsonRecord(value, "CAVI workspace");
  } catch {
    throw new Error(WORKSPACE_SCHEMA_ERROR);
  }
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
    const projectSnapshot = safeSnapshot(projectBoard.data);
    const operatorSnapshot = safeSnapshot(operator.data);
    const candidates: Array<{ identity: ExplicitWorkspaceIdentity; method: string; transport: "http" | "websocket"; providerData?: Record<string, unknown> }> = [];
    const projectIdentity = workspaceIdentity(projectSnapshot.workspaceIdentity);
    if (projectIdentity) candidates.push({ identity: projectIdentity, method: "project-board.workspace", transport: "http" });
    const registry = record(operatorSnapshot.registryDetail);
    const agents = Array.isArray(registry?.agents) ? registry.agents : [];
    for (const value of agents) {
      const agent = record(value);
      const identity = workspaceIdentity(agent?.workspaceIdentity);
      if (identity) candidates.push({
        identity, method: "operator.registry", transport: "websocket",
        ...(typeof agent?.id === "string" ? { providerData: { agentId: agent.id } } : {}),
      });
    }
    const identities = new Map<string, ExplicitWorkspaceIdentity>();
    const workspaces: RuntimeWorkspaceDescriptor[] = [];
    for (const candidate of candidates) {
      const existing = identities.get(candidate.identity.id);
      if (existing) {
        if (existing.accessMode !== candidate.identity.accessMode
          || existing.root !== candidate.identity.root
          || existing.displayName !== candidate.identity.displayName) {
          throw new Error(WORKSPACE_SCHEMA_ERROR);
        }
        continue;
      }
      identities.set(candidate.identity.id, candidate.identity);
      workspaces.push(mapWorkspace(candidate.identity, candidate.method, candidate.transport, candidate.providerData));
    }
    return workspaces;
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

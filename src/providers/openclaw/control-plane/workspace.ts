import {
  ApiClientError,
  ApiClientErrorCode,
  toError,
} from "../../../core/errors.js";
import type { RuntimeControlPlaneMetadata } from "../../../core/runtime/control-plane/types.js";
import type { RuntimeWorkspaceDescriptor } from "../../../core/runtime/control-plane/workspace.js";

import type { OpenClawRpc } from "./rpc.js";
import { parseOpenClaw } from "./protocol-error.js";
import { parseAgentsList } from "./wire.js";

type WireAgent = {
  id: string;
  name?: string;
  identity?: Record<string, unknown>;
  workspace?: string;
};

function metadata(agent: WireAgent): RuntimeControlPlaneMetadata {
  const providerData: Record<string, unknown> = { agentId: agent.id };
  if (agent.identity !== undefined) providerData.identity = agent.identity;
  return {
    provider: "openclaw",
    stability: "experimental",
    source: { transport: "websocket", method: "agents.list" },
    providerData,
  };
}

async function listAgents(rpc: OpenClawRpc): Promise<WireAgent[]> {
  try {
    const payload = await rpc.request("agents.list", {}, { signal: undefined });
    const parsed = parseOpenClaw("agents.list", () => parseAgentsList(payload));
    return parsed.agents as WireAgent[];
  } catch (error) {
    throw toError(error, "OpenClaw agents.list request failed");
  }
}

function mapWorkspace(agent: WireAgent): RuntimeWorkspaceDescriptor {
  const root = agent.workspace as string;
  return {
    id: `openclaw-workspace:${encodeURIComponent(root)}`,
    providerId: root,
    ...(agent.name === undefined ? {} : { displayName: agent.name }),
    root,
    accessMode: "unknown",
    metadata: metadata(agent),
  };
}

export function createOpenClawWorkspaceClient(rpc: OpenClawRpc) {
  return {
    async listWorkspaces(): Promise<readonly RuntimeWorkspaceDescriptor[]> {
      const seen = new Set<string>();
      return (await listAgents(rpc))
        .filter((agent) => agent.workspace !== undefined && !seen.has(agent.workspace) && seen.add(agent.workspace))
        .map(mapWorkspace);
    },

    async getWorkspace(id: string): Promise<RuntimeWorkspaceDescriptor> {
      const agent = (await listAgents(rpc)).find((candidate) =>
        candidate.workspace !== undefined && (
          `openclaw-workspace:${encodeURIComponent(candidate.workspace)}` === id
          || candidate.workspace === id
        )
      );
      if (agent === undefined) {
        throw new ApiClientError(`OpenClaw workspace not found: ${id}`, {
          code: ApiClientErrorCode.EndpointNotFound,
        });
      }
      return mapWorkspace(agent);
    },
  };
}

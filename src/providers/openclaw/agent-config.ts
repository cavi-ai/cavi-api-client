// OpenClaw agent-config dispatcher. OpenClaw exposes agent configuration over
// RPC (agents.list, config.get, config.schema, config.schema.lookup,
// config.patch, agents.files.list/get/set) — NOT over the generic
// agent-configs REST routes. See
// docs/providers/openclaw/api-endpoints.md.
//
// Each method here throws ApiClientError(EndpointNotFound) with the upstream
// RPC method name(s) that should be wired. Real RPC dispatch lands once the
// param/response shapes are verified against the live gateway (Postman pass).
//
// The class exists so the provider factory hands the UI a typed
// GatewayAgentConfigClient whose methods fail loudly and clearly rather than
// silently hitting REST routes OpenClaw doesn't serve.

import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../../core/errors.js";
import { GatewayAgentConfigApiClient } from "../../core/gateway/agent/config.js";
import type {
  AgentConfig,
  AgentConfigDraftDiff,
  AgentProfileSummary,
  PatchProfileConfigOptions,
} from "../../core/gateway/agent/config.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";
import { OPENCLAW_RPC_METHODS } from "./manifest.derive.js";
import type { OpenClawRpcTransport } from "./client.js";

function gated(method: string, rpcHint: string): never {
  throw new ApiClientError(
    `openclaw: ${method} dispatches over RPC (${rpcHint}); param/response shapes not yet verified. Wire after Postman validates the shape.`,
    {
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.EndpointNotFound,
    },
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}
function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/**
 * Map the OpenClaw `agents.list` RPC payload onto the unified profile summary.
 * Verified live (2026-07-23): `{ defaultId, mainKey, scope, agents: [{ id,
 * name, workspace, agentRuntime, ... }] }`.
 */
export function normalizeOpenClawAgentProfiles(payload: unknown): AgentProfileSummary[] {
  const root = asRecord(payload);
  if (!root) return [];
  const defaultId = cleanString(root.defaultId);
  const agents = Array.isArray(root.agents) ? root.agents : [];
  const profiles: AgentProfileSummary[] = [];
  for (const value of agents) {
    const agent = asRecord(value);
    const agentId = cleanString(agent?.id);
    if (!agentId) continue;
    const sourcePath = cleanString(agent?.workspace);
    const runtime = asRecord(agent?.agentRuntime);
    profiles.push({
      agentId,
      agentName: cleanString(agent?.name) ?? agentId,
      ...(sourcePath ? { sourcePath } : {}),
      ...(defaultId ? { isDefault: agentId === defaultId } : {}),
      model: cleanString(runtime?.id) ?? null,
      provider: null,
    });
  }
  return profiles;
}

export type OpenClawAgentConfigApiClientOptions = HttpApiClientOptions & {
  /** Shared OpenClaw socket for RPC dispatch (injected by createApiClient). */
  rpcClient?: OpenClawRpcTransport | null;
};

export class OpenClawAgentConfigApiClient extends GatewayAgentConfigApiClient {
  private readonly rpcClient: OpenClawRpcTransport | null;

  constructor(options: OpenClawAgentConfigApiClientOptions) {
    super(options, { surface: "openclaw-agent-config-api" });
    this.rpcClient = options.rpcClient ?? null;
  }

  override async listProfiles(): Promise<AgentProfileSummary[]> {
    if (!this.rpcClient) return gated("listProfiles", OPENCLAW_RPC_METHODS.agentsList);
    const payload = await this.rpcClient.request<unknown>(OPENCLAW_RPC_METHODS.agentsList, {});
    return normalizeOpenClawAgentProfiles(payload);
  }

  override async getProfileConfig(_agentId: string): Promise<AgentConfig> {
    return gated(
      "getProfileConfig",
      `${OPENCLAW_RPC_METHODS.configGet} (per-agent slice) / ${OPENCLAW_RPC_METHODS.agentsFilesGet}`,
    );
  }

  override async patchProfileConfig(
    _agentId: string,
    _diff: AgentConfigDraftDiff,
    _options?: PatchProfileConfigOptions,
  ): Promise<AgentConfig> {
    return gated(
      "patchProfileConfig",
      `${OPENCLAW_RPC_METHODS.configPatch} / ${OPENCLAW_RPC_METHODS.agentsFilesSet}`,
    );
  }
}

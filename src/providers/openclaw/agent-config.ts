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

function gated(method: string, rpcHint: string): never {
  throw new ApiClientError(
    `openclaw: ${method} dispatches over RPC (${rpcHint}); param/response shapes not yet verified. Wire after Postman validates the shape.`,
    {
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.EndpointNotFound,
    },
  );
}

export class OpenClawAgentConfigApiClient extends GatewayAgentConfigApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, { surface: "openclaw-agent-config-api" });
  }

  override async listProfiles(): Promise<AgentProfileSummary[]> {
    return gated("listProfiles", OPENCLAW_RPC_METHODS.agentsList);
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

import { GatewayAgentConfigApiClient } from "../../core/gateway/agent-config.js";
import { OPENCLAW_AGENT_CONFIG_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export class OpenClawAgentConfigApiClient extends GatewayAgentConfigApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, {
      endpoints: OPENCLAW_AGENT_CONFIG_API_ENDPOINTS,
      surface: "openclaw-agent-config-api",
    });
  }
}

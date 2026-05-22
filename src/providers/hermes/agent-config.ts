import { GatewayAgentConfigApiClient } from "../../core/gateway/agent-config.js";
import { HERMES_AGENT_CONFIG_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export class HermesAgentConfigApiClient extends GatewayAgentConfigApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, {
      endpoints: HERMES_AGENT_CONFIG_API_ENDPOINTS,
      surface: "hermes-agent-config-api",
    });
  }
}

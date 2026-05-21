import {
  GatewayApiClient,
  type GatewayCapabilities,
  type GatewayRunStatus,
} from "../../core/gateway/client.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export type HermesCapabilities = GatewayCapabilities & {
  object?: "hermes.api_server.capabilities" | string;
  platform?: "hermes-agent" | string;
};

export type HermesRunStatus = GatewayRunStatus & {
  object?: "hermes.run" | string;
};

export class HermesApiClient extends GatewayApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, "hermes-api-server");
  }
}

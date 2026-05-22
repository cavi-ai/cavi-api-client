import {
  GatewayApiClient,
  type GatewayCapabilities,
  type GatewayRunStatus,
} from "../../core/gateway/client.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export type OpenClawCapabilities = GatewayCapabilities & {
  object?: "openclaw.api_server.capabilities" | string;
  platform?: "openclaw" | string;
};

export type OpenClawRunStatus = GatewayRunStatus & {
  object?: "openclaw.run" | string;
};

export class OpenClawApiClient extends GatewayApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, "openclaw-api");
  }
}

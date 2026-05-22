import {
  GatewayWebSocketClient,
  type GatewayWebSocketClientOptions,
} from "../../core/ws/index.js";

export type OpenClawWebSocketClientOptions = GatewayWebSocketClientOptions;

export class OpenClawWebSocketClient extends GatewayWebSocketClient {
  constructor(
    wsUrl: string,
    authToken: string | null,
    options: OpenClawWebSocketClientOptions = {},
  ) {
    super(wsUrl, authToken, options);
  }
}

import {
  GatewayWebSocketClient,
  type GatewayWebSocketClientOptions,
} from "../../core/ws/index.js";

export type HermesWebSocketClientOptions = GatewayWebSocketClientOptions;

export class HermesWebSocketClient extends GatewayWebSocketClient {
  constructor(
    wsUrl: string,
    authToken: string | null,
    options: HermesWebSocketClientOptions = {},
  ) {
    super(wsUrl, authToken, options);
  }
}

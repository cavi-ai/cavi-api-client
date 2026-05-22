import {
  GatewayRpcClient,
  type GatewayRpcClientOptions,
} from "../../core/gateway/rpc.js";

export type OpenClawWebSocketClientOptions = GatewayRpcClientOptions;

export class OpenClawWebSocketClient extends GatewayRpcClient {
  constructor(
    wsUrl: string,
    authToken: string | null,
    options: OpenClawWebSocketClientOptions = {},
  ) {
    super(wsUrl, authToken, options);
  }
}

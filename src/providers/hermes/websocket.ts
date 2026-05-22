import {
  GatewayRpcClient,
  type GatewayRpcClientOptions,
} from "../../core/gateway/rpc.js";

export type HermesWebSocketClientOptions = GatewayRpcClientOptions;

export class HermesWebSocketClient extends GatewayRpcClient {
  constructor(
    wsUrl: string,
    authToken: string | null,
    options: HermesWebSocketClientOptions = {},
  ) {
    super(wsUrl, authToken, options);
  }
}

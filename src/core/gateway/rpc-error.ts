// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

export class GatewayRpcError extends Error {
  readonly code: string;

  constructor(message: string, code = "gateway_error") {
    super(message);
    this.name = "GatewayRpcError";
    this.code = code;
  }
}

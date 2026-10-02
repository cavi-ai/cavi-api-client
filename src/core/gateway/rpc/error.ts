// CANONICAL — single source of truth lives here. Do not duplicate.

import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../../errors.js";
import type { TransportErrorMetadata } from "../../transport/error.js";

export class GatewayRpcError extends ApiClientError {
  declare readonly type: ApiClientErrorType.GatewayRpc;
  declare readonly code: string;

  constructor(
    message: string,
    code: string = ApiClientErrorCode.GatewayError,
    readonly transport?: TransportErrorMetadata,
  ) {
    super(message, { type: ApiClientErrorType.GatewayRpc, code });
    this.name = "GatewayRpcError";
  }
}

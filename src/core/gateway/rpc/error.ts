// CANONICAL — single source of truth lives here. Do not duplicate.

import {
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../../errors.js";
import type { TransportErrorMetadata } from "../../transport/error.js";

export class GatewayRpcError extends Error {
  readonly type = ApiClientErrorType.GatewayRpc;
  readonly code: string;

  constructor(
    message: string,
    code: string = ApiClientErrorCode.GatewayError,
    readonly transport?: TransportErrorMetadata,
  ) {
    super(message);
    this.name = "GatewayRpcError";
    this.code = code;
  }
}

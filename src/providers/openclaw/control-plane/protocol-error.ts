import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../../../core/errors.js";

import { OpenClawWireError } from "./wire.js";

export function openClawProtocolError(operation: string): ApiClientError {
  return new ApiClientError(`OpenClaw ${operation} returned an invalid protocol payload`, {
    type: ApiClientErrorType.Transport,
    code: ApiClientErrorCode.TransportProtocolError,
    runtime: {
      provider: "openclaw",
      transport: "websocket",
      operation,
      retryable: false,
    },
  });
}

export function openClawNativeEventProtocolError(): ApiClientError {
  return new ApiClientError("OpenClaw native event returned an invalid protocol payload", {
    type: ApiClientErrorType.Transport,
    code: ApiClientErrorCode.TransportProtocolError,
    runtime: {
      provider: "openclaw",
      transport: "websocket",
      operation: "events.native",
      retryable: false,
    },
  });
}

export function parseOpenClaw<T>(operation: string, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof OpenClawWireError) throw openClawProtocolError(operation);
    throw error;
  }
}

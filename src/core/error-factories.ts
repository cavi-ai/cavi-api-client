import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "./errors.js";

/** Caller input rejected before any request is made. */
export function invalidInputError(message: string): ApiClientError {
  return new ApiClientError(message, {
    type: ApiClientErrorType.Validation,
    code: ApiClientErrorCode.ValidationFailed,
  });
}

/** Client, provider, or registry configuration that cannot work. */
export function invalidConfigError(message: string): ApiClientError {
  return new ApiClientError(message, {
    type: ApiClientErrorType.Configuration,
    code: ApiClientErrorCode.InvalidConfig,
  });
}

/** A response, frame, or payload that does not match the expected wire contract. */
export function protocolError(type: ApiClientErrorType, message: string): ApiClientError {
  return new ApiClientError(message, { type, code: ApiClientErrorCode.ProtocolMismatch });
}

/** A response body that is not valid JSON. */
export function invalidJsonError(type: ApiClientErrorType, message: string): ApiClientError {
  return new ApiClientError(message, { type, code: ApiClientErrorCode.InvalidJson });
}

/** An aborted operation. Keeps the platform `AbortError` name. */
export function abortError(message = "The operation was aborted"): ApiClientError {
  const error = new ApiClientError(message, {
    type: ApiClientErrorType.Abort,
    code: ApiClientErrorCode.Aborted,
  });
  error.name = "AbortError";
  return error;
}

/** No live gateway connection to send the request over. */
export function notConnectedError(message: string): ApiClientError {
  return new ApiClientError(message, {
    type: ApiClientErrorType.Transport,
    code: ApiClientErrorCode.SocketUnavailable,
  });
}

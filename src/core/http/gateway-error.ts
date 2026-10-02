import {
  cleanGatewayErrorText,
  extractGatewayErrorDetails,
  formatGatewayHttpErrorMessage,
  parseGatewayErrorText,
} from "../gateway/client/error-details.js";
import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../errors.js";

export {
  cleanGatewayErrorText,
  extractGatewayErrorDetails,
  parseGatewayErrorText,
};

/**
 * `code` is the gateway's own error code when the response carried one, and
 * `ApiClientErrorCode.GatewayError` otherwise.
 */
export class GatewayHttpError extends ApiClientError {
  declare readonly type: ApiClientErrorType.GatewayHttp;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message, {
      type: ApiClientErrorType.GatewayHttp,
      code: code ?? ApiClientErrorCode.GatewayError,
    });
    this.name = "GatewayHttpError";
    this.status = status;
  }
}

export function buildGatewayHttpError(params: {
  label: string;
  status: number;
  statusText: string;
  message?: string | null;
  code?: string | null;
}): GatewayHttpError {
  return new GatewayHttpError(
    formatGatewayHttpErrorMessage(params),
    params.status,
    cleanGatewayErrorText(params.code),
  );
}

export function isGatewayHttpError(error: unknown): error is GatewayHttpError {
  return error instanceof GatewayHttpError;
}

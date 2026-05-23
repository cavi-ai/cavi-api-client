import {
  cleanGatewayErrorText,
  extractGatewayErrorDetails,
  formatGatewayHttpErrorMessage,
  parseGatewayErrorText,
} from "../gateway/client/error-details.js";

export {
  cleanGatewayErrorText,
  extractGatewayErrorDetails,
  parseGatewayErrorText,
};

export class GatewayHttpError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "GatewayHttpError";
    this.status = status;
    this.code = code;
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

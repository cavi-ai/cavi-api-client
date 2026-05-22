import {
  cleanGatewayErrorText,
  extractGatewayErrorDetails,
  formatGatewayHttpErrorMessage,
  parseGatewayErrorText,
} from "../../../core/gateway/error-details.js";

export {
  cleanGatewayErrorText,
  extractGatewayErrorDetails,
  parseGatewayErrorText,
};

export class CaviControlApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "CaviControlApiError";
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
}): CaviControlApiError {
  return new CaviControlApiError(
    formatGatewayHttpErrorMessage(params),
    params.status,
    cleanGatewayErrorText(params.code),
  );
}

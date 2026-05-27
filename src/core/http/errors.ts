import type { HttpApiHttpMethod } from "./types.js";
import {
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../errors.js";

export class HttpApiError extends Error {
  readonly type = ApiClientErrorType.Http;
  readonly code = ApiClientErrorCode.HttpRequestFailed;
  readonly path: string;
  readonly url: string;
  readonly method: HttpApiHttpMethod;
  readonly status: number;
  readonly body: string;

  constructor(params: {
    message: string;
    path: string;
    url: string;
    method: HttpApiHttpMethod;
    status: number;
    body: string;
  }) {
    super(params.message);
    this.name = "HttpApiError";
    this.path = params.path;
    this.url = params.url;
    this.method = params.method;
    this.status = params.status;
    this.body = params.body;
  }
}

export function isHttpApiError(error: unknown): error is HttpApiError {
  return error instanceof HttpApiError;
}

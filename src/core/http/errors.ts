import type { HttpApiHttpMethod } from "./types.js";

export class HttpApiError extends Error {
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

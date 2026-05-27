import { BaseHttpApiClient } from "./client.js";
import type {
  HttpApiHttpMethod,
  HttpApiRequestInit,
  HttpApiTrace,
} from "./types.js";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function normalizeHttpMethod(method: string | undefined): HttpApiHttpMethod | undefined {
  const normalized = method?.trim().toUpperCase();
  return normalized && HTTP_METHODS.has(normalized)
    ? (normalized as HttpApiHttpMethod)
    : undefined;
}

export class RawHttpApiClient extends BaseHttpApiClient {
  raw(path: string, init?: HttpApiRequestInit): Promise<Response> {
    return this.requestRaw(path, init);
  }
}

export function createRawHttpApiClient(params: {
  surface: HttpApiTrace["surface"];
  baseUrl: string;
  authToken: string | null;
  clientId?: string | null;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  fetchImpl?: typeof fetch;
}): RawHttpApiClient {
  return new RawHttpApiClient(params.surface, {
    baseUrl: params.baseUrl,
    allowRelativeBaseUrl: true,
    auth: {
      bearerToken: params.authToken,
      clientId: params.clientId,
    },
    credentials: params.credentials,
    cache: params.cache,
    fetchImpl: params.fetchImpl,
  });
}

export function toHttpRequestInit(
  init: RequestInit | undefined,
  headers?: Record<string, string>,
): HttpApiRequestInit {
  return {
    method: normalizeHttpMethod(init?.method),
    headers,
    rawBody: init?.body ?? undefined,
    signal: init?.signal ?? undefined,
    cache: init?.cache ?? undefined,
    credentials: init?.credentials ?? undefined,
  };
}

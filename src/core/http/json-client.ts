import { BaseHttpApiClient } from "./client.js";
import { HttpApiError } from "./errors.js";
import type { HttpApiRequestInit, HttpApiTrace } from "./types.js";
import {
  buildGatewayHttpError,
  parseGatewayErrorText,
} from "./gateway-error.js";

export function withQuery(
  path: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export type JsonHttpRequest = <TData>(
  path: string,
  init?: HttpApiRequestInit,
) => Promise<TData>;

export class JsonHttpApiClient extends BaseHttpApiClient {
  request<TData>(path: string, init?: HttpApiRequestInit): Promise<TData> {
    return this.requestJsonBody<TData>(path, init);
  }

  private async requestJsonBody<TData>(
    path: string,
    init?: HttpApiRequestInit,
  ): Promise<TData> {
    try {
      const response = await this.requestRaw(path, init);
      const text = await response.text();
      if (response.status === 204 || !text.trim()) {
        return {} as TData;
      }
      try {
        return JSON.parse(text) as TData;
      } catch {
        throw new Error(`Invalid JSON from ${path}.`);
      }
    } catch (error) {
      if (error instanceof HttpApiError && error.status > 0) {
        const details = parseGatewayErrorText(error.body, "application/json");
        throw buildGatewayHttpError({
          label: error.path,
          status: error.status,
          statusText: "",
          message: details.message,
          code: details.code,
        });
      }
      throw error;
    }
  }
}

export function createJsonHttpRequest(opts: {
  surface: HttpApiTrace["surface"];
  httpBase: string;
  authToken: string | null;
  clientId?: string | null;
  credentials?: RequestCredentials;
  cache?: RequestCache;
}): JsonHttpRequest {
  const client = new JsonHttpApiClient(opts.surface, {
    baseUrl: opts.httpBase,
    allowRelativeBaseUrl: true,
    auth: {
      bearerToken: opts.authToken,
      clientId: opts.clientId,
    },
    credentials: opts.credentials,
    cache: opts.cache,
  });

  return async function requestJson<TData>(
    path: string,
    init?: HttpApiRequestInit,
  ): Promise<TData> {
    return await client.request<TData>(path, init);
  };
}

import { BaseHttpApiClient } from "../../../core/http/client.js";
import { HttpApiError } from "../../../core/http/errors.js";
import type { HttpApiRequestInit } from "../../../core/http/types.js";
import { isSessionAuthMode } from "../lib/standalone-mode.js";
import {
  buildGatewayHttpError,
  parseGatewayErrorText,
} from "./api-error.js";

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

export type CaviControlRequestJson = <TData>(
  path: string,
  init?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<TData>;

class CaviControlHttpClient extends BaseHttpApiClient {
  request<TData>(path: string, init?: HttpApiRequestInit): Promise<TData> {
    return this.requestCaviJson<TData>(path, init);
  }

  private async requestCaviJson<TData>(
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

export function createCaviControlRequestJson(opts: {
  httpBase: string;
  authToken: string | null;
}): CaviControlRequestJson {
  const sessionMode = isSessionAuthMode();
  const client = new CaviControlHttpClient("cavi-control-api", {
    baseUrl: opts.httpBase,
    allowRelativeBaseUrl: true,
    auth: {
      bearerToken: sessionMode ? null : opts.authToken,
    },
    credentials: sessionMode ? "same-origin" : undefined,
  });

  return async function requestJson<TData>(
    path: string,
    init?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      body?: unknown;
    },
  ): Promise<TData> {
    return await client.request<TData>(path, init);
  };
}

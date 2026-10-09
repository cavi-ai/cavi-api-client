import { BaseHttpApiClient } from "./client.js";
import { HttpApiError } from "./errors.js";
import type { HttpApiRequestInit, HttpApiTrace } from "./types.js";
import {
  buildGatewayHttpError,
  parseGatewayErrorText,
} from "./gateway-error.js";
import { redactPreviewText } from "./redaction.js";

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
  if (!query) return path;
  const fragmentIndex = path.indexOf("#");
  const target = fragmentIndex === -1 ? path : path.slice(0, fragmentIndex);
  const fragment = fragmentIndex === -1 ? "" : path.slice(fragmentIndex);
  const separator = target.includes("?")
    ? (target.endsWith("?") || target.endsWith("&") ? "" : "&")
    : "?";
  return `${target}${separator}${query}${fragment}`;
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
    let parseError: HttpApiError | undefined;
    try {
      return await this.requestWithResponse(path, init, async (response) => {
        const text = await response.text();
        if (response.status === 204 || !text.trim()) {
          return {} as TData;
        }
        try {
          return JSON.parse(text) as TData;
        } catch {
          const contentType = response.headers.get("content-type") ?? "unknown";
          const preview = redactPreviewText(text.trim(), 500);
          const method = init?.method ?? "GET";
          const safePath = redactPreviewText(path, 2_000);
          // Parser messages may contain unredacted, truncated response excerpts.
          parseError = new HttpApiError({
            message: `${method} ${safePath} returned invalid JSON (content-type=${contentType}; preview=${preview})`,
            path,
            url: path,
            method,
            status: response.status,
            body: text,
          });
          throw parseError;
        }
      });
    } catch (error) {
      if (init?.signal?.aborted && error === init.signal.reason) {
        throw error;
      }
      if (parseError !== undefined && error === parseError) {
        throw error;
      }
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
  defaultHeaders?: Record<string, string>;
  credentials?: RequestCredentials;
  cache?: RequestCache;
}): JsonHttpRequest {
  const client = new JsonHttpApiClient(opts.surface, {
    baseUrl: opts.httpBase,
    allowRelativeBaseUrl: true,
    defaultHeaders: opts.defaultHeaders,
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

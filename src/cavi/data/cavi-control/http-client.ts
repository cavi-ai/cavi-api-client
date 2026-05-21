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

export function createCaviControlRequestJson(opts: {
  httpBase: string;
  authToken: string | null;
}): CaviControlRequestJson {
  const sessionMode = isSessionAuthMode();

  return async function requestJson<TData>(
    path: string,
    init?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      body?: unknown;
    },
  ): Promise<TData> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    // In session mode, the httpOnly cookie carries auth — server.mjs injects
    // the gateway token on the proxy side. No Authorization header needed.
    if (!sessionMode && opts.authToken) {
      headers.Authorization = `Bearer ${opts.authToken}`;
    }

    const body =
      init?.body === undefined ? undefined : JSON.stringify(init.body);
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${opts.httpBase}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body,
      cache: "no-store",
      ...(sessionMode ? { credentials: "same-origin" as RequestCredentials } : {}),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (!response.ok) {
      const details = parseGatewayErrorText(text, contentType);
      throw buildGatewayHttpError({
        label: path,
        status: response.status,
        statusText: response.statusText,
        message: details.message,
        code: details.code,
      });
    }

    if (response.status === 204) {
      return {} as TData;
    }

    if (!text.trim()) {
      return {} as TData;
    }

    try {
      return JSON.parse(text) as TData;
    } catch {
      throw new Error(`Invalid JSON from ${path}.`);
    }
  };
}

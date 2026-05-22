import {
  gatewayAuthHeaders,
  gatewayRequestCredentials,
} from "../runtime/gateway-json-fetch.js";
import { HttpApiError } from "../../core/http/errors.js";
import {
  createRawHttpApiClient,
  toHttpRequestInit,
} from "../../core/http/raw-client.js";
import { extractGatewayErrorDetails } from "../../core/gateway/error-details.js";
import { LIBRARY_API_BASE_PATH } from "../paths.js";

type LibraryApiMutationMethod =
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export type LibraryApiRequestJson = <TData>(
  path: string,
  init?: {
    method?: LibraryApiMutationMethod;
    body?: unknown;
  },
) => Promise<TData>;

function normalizeLibraryApiPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function resolveLibraryApiPath(path: string): string {
  return `${LIBRARY_API_BASE_PATH}${normalizeLibraryApiPath(path)}`;
}

function appendLibraryApiQuery(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export async function fetchLibraryApiJson<T>(
  path: string,
  clientId: string,
  authToken: string | null,
  options?: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    cache?: RequestCache;
  },
): Promise<T> {
  const headers = gatewayAuthHeaders(clientId, authToken);
  const init: RequestInit = {
    method: options?.method ?? "GET",
    signal: options?.signal,
    cache: options?.cache ?? "no-store",
  };
  if (options && "body" in options) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const credentials = gatewayRequestCredentials();
  const client = createRawHttpApiClient({
    surface: "library-api",
    baseUrl: "",
    authToken: credentials ? null : authToken,
    clientId,
    credentials,
  });
  const response = await client.raw(
    resolveLibraryApiPath(path),
    toHttpRequestInit(
      {
        ...init,
        ...(credentials ? { credentials } : {}),
      },
      headers,
    ),
  ).catch((error: unknown) => {
    if (error instanceof HttpApiError && error.status > 0) {
      const payload = parseLibraryApiPayload(error.body, error.status);
      const fallbackMessage = error.body.trim() || `Request failed (${error.status})`;
      throw new Error(extractGatewayErrorDetails(payload).message ?? fallbackMessage);
    }
    throw error;
  });
  const raw = await response.text();

  const payload = parseLibraryApiPayload(raw, response.status);

  if (payload === null) {
    throw new Error("Empty response.");
  }

  return payload as T;
}

export async function requestLibraryApiJson<T>(
  requestJson: LibraryApiRequestJson,
  path: string,
  options?: {
    method?: LibraryApiMutationMethod;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
  },
): Promise<T> {
  const requestPath = appendLibraryApiQuery(
    resolveLibraryApiPath(path),
    options?.query,
  );
  const init =
    options && (options.method !== undefined || "body" in options)
      ? {
          method: options.method,
          body: options.body,
        }
      : undefined;
  return await requestJson<T>(requestPath, init);
}

function parseLibraryApiPayload(raw: string, status: number): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(raw.trim() || `Librarian error (${status})`);
  }
}

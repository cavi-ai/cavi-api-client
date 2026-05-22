import { HttpApiError } from "../../core/http/errors.js";
import {
  createRawHttpApiClient,
  toHttpRequestInit,
} from "../../core/http/raw-client.js";
import {
  buildGatewayAuthHeaders,
  resolveGatewayRequestCredentials,
} from "../../core/gateway/fetch.js";
import { extractGatewayErrorDetails } from "../../core/gateway/error-details.js";
import { appendHttpQuery, resolveLibraryApiPath } from "../paths.js";
import { isSessionAuthMode } from "../runtime/standalone-mode.js";

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
  const sessionAuthMode = isSessionAuthMode();
  const headers = buildGatewayAuthHeaders(clientId, authToken, {
    includeBearerToken: !sessionAuthMode,
  });
  const init: RequestInit = {
    method: options?.method ?? "GET",
    signal: options?.signal,
    cache: options?.cache ?? "no-store",
  };
  if (options && "body" in options) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const credentials = resolveGatewayRequestCredentials(sessionAuthMode);
  const client = createRawHttpApiClient({
    surface: "library-api",
    baseUrl: "",
    authToken: sessionAuthMode ? null : authToken,
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
  const requestPath = appendHttpQuery(
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

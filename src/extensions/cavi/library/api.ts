import { invalidJsonError, protocolError } from "../../../core/error-factories.js";
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../../core/errors.js";
import { HttpApiError } from "../../../core/http/errors.js";
import {
  createRawHttpApiClient,
  toHttpRequestInit,
} from "../../../core/http/raw-client.js";
import {
  buildGatewayAuthHeaders,
  resolveGatewayRequestCredentials,
} from "../../../core/gateway/client/fetch.js";
import { extractGatewayErrorDetails } from "../../../core/gateway/client/error-details.js";
import { redactPreviewText } from "../../../core/http/redaction.js";
import { appendHttpQuery, resolveLibraryApiPath } from "../contracts/paths.js";
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
  return client.consumeResponse<T>(
    resolveLibraryApiPath(path),
    toHttpRequestInit(
      {
        ...init,
        ...(credentials ? { credentials } : {}),
      },
      headers,
    ),
    async (response) => {
      const raw = await response.text();
      const payload = parseLibraryApiPayload(raw, response.status);
      if (payload === null) {
        throw protocolError(ApiClientErrorType.Http, "Empty response.");
      }
      return payload as T;
    },
  ).catch((error: unknown) => {
    if (error instanceof HttpApiError && error.status > 0) {
      const payload = parseLibraryApiPayload(error.body, error.status);
      const fallbackMessage =
        redactPreviewText(error.body.trim(), 180) ||
        `Request failed (${error.status})`;
      throw new ApiClientError(extractGatewayErrorDetails(payload).message ?? fallbackMessage, {
        type: ApiClientErrorType.Http,
        code: ApiClientErrorCode.HttpRequestFailed,
        cause: error,
      });
    }
    throw error;
  });
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
    throw invalidJsonError(ApiClientErrorType.Http,
      redactPreviewText(raw.trim(), 180) || `Librarian error (${status})`,
    );
  }
}

import { requirePortalClientId, PORTAL_CLIENT_ID_HEADER } from "../http/client-id.js";
import { HttpApiError } from "../http/errors.js";
import {
  buildGatewayHttpError,
  parseGatewayErrorText,
} from "../http/gateway-error.js";
import {
  createRawHttpApiClient,
  toHttpRequestInit,
} from "../http/raw-client.js";
import type { HttpApiTrace } from "../http/types.js";

export type GatewayHttpFetchOptions = Omit<RequestInit, "headers"> & {
  httpBaseUrl: string;
  clientId: string;
  authToken: string | null;
  /** Shown in thrown errors, e.g. "Gateway API". */
  apiLabel: string;
  headers?: Record<string, string>;
  sessionAuthMode?: boolean;
  surface?: HttpApiTrace["surface"];
  fetchImpl?: typeof fetch;
};

export function buildGatewayAuthHeaders(
  clientId: string,
  authToken: string | null,
  options?: {
    includeBearerToken?: boolean;
  },
): Record<string, string> {
  const includeBearerToken = options?.includeBearerToken ?? true;
  const headers: Record<string, string> = {
    Accept: "application/json",
    [PORTAL_CLIENT_ID_HEADER]: requirePortalClientId(clientId),
  };
  if (includeBearerToken && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

export function resolveGatewayRequestCredentials(
  sessionAuthMode: boolean | null | undefined,
): RequestCredentials | undefined {
  return sessionAuthMode ? "same-origin" : undefined;
}

async function parseGatewayJsonResponse<T>(
  res: Response,
  endpoint: string,
  apiLabel: string,
): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    const details = parseGatewayErrorText(text, contentType);
    throw buildGatewayHttpError({
      label: apiLabel,
      status: res.status,
      statusText: res.statusText,
      message: details.message,
      code: details.code,
    });
  }

  if (!contentType.includes("application/json")) {
    const trimmed = text.trimStart().toLowerCase();
    const htmlHint =
      trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")
        ? ` (received HTML - check ${endpoint} gateway wiring)`
        : "";

    throw new Error(
      `Expected JSON from ${endpoint}, got ${contentType || "unknown"}${htmlHint}`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${endpoint}.`);
  }
}

function throwGatewayHttpErrorFromCore(
  error: HttpApiError,
  apiLabel: string,
): never {
  const details = parseGatewayErrorText(error.body, "application/json");
  throw buildGatewayHttpError({
    label: apiLabel,
    status: error.status,
    statusText: "",
    message: details.message,
    code: details.code,
  });
}

export async function requestGatewayRaw(
  path: string,
  options: GatewayHttpFetchOptions,
): Promise<Response> {
  const {
    httpBaseUrl,
    clientId,
    authToken,
    apiLabel,
    headers: extraHeaders,
    sessionAuthMode,
    surface,
    fetchImpl,
    ...init
  } = options;
  const credentials = resolveGatewayRequestCredentials(sessionAuthMode);
  const client = createRawHttpApiClient({
    surface: surface ?? "gateway-api",
    baseUrl: httpBaseUrl,
    authToken: sessionAuthMode ? null : authToken,
    clientId,
    credentials,
    fetchImpl,
  });

  try {
    return await client.raw(
      path,
      toHttpRequestInit(
        {
          ...init,
          ...(credentials ? { credentials } : {}),
        },
        extraHeaders,
      ),
    );
  } catch (error) {
    if (error instanceof HttpApiError && error.status > 0) {
      throwGatewayHttpErrorFromCore(error, apiLabel);
    }
    throw error;
  }
}

export async function fetchGatewayJson<T>(
  path: string,
  options: GatewayHttpFetchOptions,
): Promise<T> {
  const res = await requestGatewayRaw(path, options);
  return parseGatewayJsonResponse<T>(res, path, options.apiLabel);
}

export async function fetchGatewayExpectOk(
  path: string,
  options: GatewayHttpFetchOptions,
): Promise<void> {
  await requestGatewayRaw(path, options);
}

export async function fetchGatewayBlob(
  path: string,
  options: GatewayHttpFetchOptions,
): Promise<Blob> {
  const res = await requestGatewayRaw(path, options);
  return res.blob();
}

export async function fetchGatewayFormDataJson<T>(
  path: string,
  options: Omit<GatewayHttpFetchOptions, "body" | "method"> & {
    body: FormData;
  },
): Promise<T> {
  const res = await requestGatewayRaw(path, {
    ...options,
    method: "POST",
    body: options.body,
  });
  return parseGatewayJsonResponse<T>(res, path, options.apiLabel);
}

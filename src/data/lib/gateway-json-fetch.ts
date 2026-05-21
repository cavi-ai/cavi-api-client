import {
  buildGatewayHttpError,
  parseGatewayErrorText,
} from "../cavi-control/api-error.js";
import { resolveGatewayHttpUrl } from "../cavi-control/runtime-paths.js";
import {
  PORTAL_CLIENT_ID_HEADER,
  requirePortalClientId,
} from "./portal-client-id.js";
import { isSessionAuthMode } from "./standalone-mode.js";

export function gatewayAuthHeaders(
  clientId: string,
  authToken: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    [PORTAL_CLIENT_ID_HEADER]: requirePortalClientId(clientId),
  };
  if (!isSessionAuthMode() && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

export function gatewayRequestCredentials(): RequestCredentials | undefined {
  return isSessionAuthMode() ? "same-origin" : undefined;
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

export type FetchGatewayJsonOptions = Omit<RequestInit, "headers"> & {
  gatewayBaseUrl: string;
  clientId: string;
  authToken: string | null;
  /** Shown in thrown errors, e.g. "Martina API". */
  apiLabel: string;
  headers?: Record<string, string>;
};

export async function fetchGatewayJson<T>(
  path: string,
  options: FetchGatewayJsonOptions,
): Promise<T> {
  const {
    gatewayBaseUrl,
    clientId,
    authToken,
    apiLabel,
    headers: extraHeaders,
    ...init
  } = options;
  const headers = { ...gatewayAuthHeaders(clientId, authToken), ...extraHeaders };
  const credentials = gatewayRequestCredentials();
  const res = await fetch(resolveGatewayHttpUrl(gatewayBaseUrl, path), {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
    ...(credentials ? { credentials } : {}),
  });
  return parseGatewayJsonResponse<T>(res, path, apiLabel);
}

export async function fetchGatewayExpectOk(
  path: string,
  options: FetchGatewayJsonOptions,
): Promise<void> {
  const {
    gatewayBaseUrl,
    clientId,
    authToken,
    apiLabel,
    headers: extraHeaders,
    ...init
  } = options;
  const headers = { ...gatewayAuthHeaders(clientId, authToken), ...extraHeaders };
  const credentials = gatewayRequestCredentials();
  const res = await fetch(resolveGatewayHttpUrl(gatewayBaseUrl, path), {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
    ...(credentials ? { credentials } : {}),
  });
  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const details = parseGatewayErrorText(text, contentType);
    throw buildGatewayHttpError({
      label: apiLabel,
      status: res.status,
      statusText: res.statusText,
      message: details.message,
      code: details.code,
    });
  }
}

export async function fetchGatewayBlob(
  path: string,
  options: FetchGatewayJsonOptions,
): Promise<Blob> {
  const {
    gatewayBaseUrl,
    clientId,
    authToken,
    apiLabel,
    headers: extraHeaders,
    ...init
  } = options;
  const headers = { ...gatewayAuthHeaders(clientId, authToken), ...extraHeaders };
  const credentials = gatewayRequestCredentials();
  const res = await fetch(resolveGatewayHttpUrl(gatewayBaseUrl, path), {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
    ...(credentials ? { credentials } : {}),
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const details = parseGatewayErrorText(text, contentType);
    throw buildGatewayHttpError({
      label: apiLabel,
      status: res.status,
      statusText: res.statusText,
      message: details.message,
      code: details.code,
    });
  }

  return res.blob();
}

export async function fetchGatewayFormDataJson<T>(
  path: string,
  options: {
    gatewayBaseUrl: string;
    clientId: string;
    authToken: string | null;
    apiLabel: string;
    body: FormData;
  },
): Promise<T> {
  const headers = gatewayAuthHeaders(options.clientId, options.authToken);
  const credentials = gatewayRequestCredentials();
  const res = await fetch(
    resolveGatewayHttpUrl(options.gatewayBaseUrl, path),
    {
      method: "POST",
      headers,
      body: options.body,
      cache: "no-store",
      ...(credentials ? { credentials } : {}),
    },
  );
  return parseGatewayJsonResponse<T>(res, path, options.apiLabel);
}

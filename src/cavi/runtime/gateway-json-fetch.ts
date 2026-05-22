import {
  buildGatewayHttpError,
  parseGatewayErrorText,
} from "../../core/http/gateway-error.js";
import { HttpApiError } from "../../core/http/errors.js";
import {
  createRawHttpApiClient,
  toHttpRequestInit,
} from "../../core/http/raw-client.js";
import { resolveGatewayHttpBase } from "../data/cavi-control/runtime-paths.js";
import {
  PORTAL_CLIENT_ID_HEADER,
  requirePortalClientId,
} from "../../core/http/client-id.js";
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

async function requestGatewayRaw(
  path: string,
  options: FetchGatewayJsonOptions,
): Promise<Response> {
  const {
    gatewayBaseUrl,
    clientId,
    authToken,
    apiLabel,
    headers: extraHeaders,
    ...init
  } = options;
  const sessionMode = isSessionAuthMode();
  const client = createRawHttpApiClient({
    surface: "gateway-api",
    baseUrl: resolveGatewayHttpBase(gatewayBaseUrl),
    authToken: sessionMode ? null : authToken,
    clientId,
    credentials: sessionMode ? "same-origin" : undefined,
  });

  try {
    return await client.raw(path, toHttpRequestInit(init, extraHeaders));
  } catch (error) {
    if (error instanceof HttpApiError && error.status > 0) {
      throwGatewayHttpErrorFromCore(error, apiLabel);
    }
    throw error;
  }
}

export async function fetchGatewayJson<T>(
  path: string,
  options: FetchGatewayJsonOptions,
): Promise<T> {
  const res = await requestGatewayRaw(path, options);
  return parseGatewayJsonResponse<T>(res, path, options.apiLabel);
}

export async function fetchGatewayExpectOk(
  path: string,
  options: FetchGatewayJsonOptions,
): Promise<void> {
  await requestGatewayRaw(path, options);
}

export async function fetchGatewayBlob(
  path: string,
  options: FetchGatewayJsonOptions,
): Promise<Blob> {
  const res = await requestGatewayRaw(path, options);
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
  const res = await requestGatewayRaw(path, {
    gatewayBaseUrl: options.gatewayBaseUrl,
    clientId: options.clientId,
    authToken: options.authToken,
    apiLabel: options.apiLabel,
    method: "POST",
    body: options.body,
  });
  return parseGatewayJsonResponse<T>(res, path, options.apiLabel);
}

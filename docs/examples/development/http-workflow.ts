import {
  JsonHttpApiClient,
  RawHttpApiClient,
  isGatewayHttpError,
  isHttpApiError,
  type HttpApiClientOptions,
} from "@cavi-ai/api-client/core/http";

/** Development package example: consume finite responses inside their deadline. */
export function createHttpReader(options: HttpApiClientOptions) {
  const json = new JsonHttpApiClient("application", options);
  const raw = new RawHttpApiClient("application", options);
  return {
    // A type parameter does not validate server data; validate unknown at your boundary.
    json: (path: string, signal: AbortSignal) => json.request<unknown>(path, { signal }),
    text: (path: string, signal: AbortSignal) =>
      raw.consumeResponse(path, { signal }, (response) => response.text()),
  };
}

/** Keep the original exception in protected telemetry; expose only a safe category. */
export function httpFailure(error: unknown, signal: AbortSignal) {
  if (signal.aborted && error === signal.reason) return { kind: "cancelled" as const };
  if (isGatewayHttpError(error)) {
    return { kind: "server" as const, status: error.status, code: error.code };
  }
  if (isHttpApiError(error)) {
    return { kind: "http" as const, status: error.status, code: error.code };
  }
  return { kind: "unexpected" as const };
}

import { describe, expect, it } from "vitest";
import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
  getErrorCode,
  getErrorMessage,
  getErrorStatus,
  getErrorType,
  isAbortError,
  isAuthError,
  isEndpointNotFoundError,
  serializeError,
  stringifyUnknownError,
  toError,
} from "../../core/errors";
import { HttpApiError, isHttpApiError } from "../../core/http/errors";
import {
  GatewayHttpError,
  isGatewayHttpError,
} from "../../core/http/gateway-error";

describe("core error helpers", () => {
  it("exposes stable generic error type and code enums", () => {
    expect(ApiClientErrorType.Http).toBe("http");
    expect(ApiClientErrorType.GatewayRpc).toBe("gateway_rpc");
    expect(ApiClientErrorCode.GatewayError).toBe("gateway_error");
    expect(ApiClientErrorCode.SocketUnavailable).toBe("socket_unavailable");
  });

  it("normalizes unknown thrown values without losing useful text", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("plain failure")).toBe("plain failure");
    expect(getErrorMessage({ code: "bad", message: "ignored" })).toBe(
      '{"code":"bad","message":"ignored"}',
    );
    expect(stringifyUnknownError(Symbol("nope"))).toBe("Symbol(nope)");
  });

  it("wraps non-Error values in a typed ApiClientError", () => {
    const error = toError({ reason: "missing" });

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      name: "ApiClientError",
      type: ApiClientErrorType.Unknown,
      code: ApiClientErrorCode.Unknown,
      message: '{"reason":"missing"}',
    });
  });

  it("reads and serializes structured error metadata", () => {
    const error = new ApiClientError("no gateway", {
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.SocketClosed,
    });

    expect(getErrorType(error)).toBe(ApiClientErrorType.Transport);
    expect(getErrorCode(error)).toBe(ApiClientErrorCode.SocketClosed);
    expect(serializeError(error)).toEqual({
      name: "ApiClientError",
      message: "no gateway",
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.SocketClosed,
    });
  });

  it("recognizes abort-shaped errors", () => {
    expect(isAbortError(new DOMException("cancelled", "AbortError"))).toBe(true);
    expect(
      isAbortError(
        new ApiClientError("aborted", {
          type: ApiClientErrorType.Abort,
          code: ApiClientErrorCode.Aborted,
        }),
      ),
    ).toBe(true);
    expect(isAbortError(new Error("other"))).toBe(false);
  });

  const httpError = (status: number) =>
    new HttpApiError({
      message: `failed ${status}`,
      path: "/api/plugins/cavi-control/operator/snapshot",
      url: "https://gateway.example.com/api/plugins/cavi-control/operator/snapshot",
      method: "GET",
      status,
      body: "",
    });

  it("narrows transport errors with typed guards instead of message matching", () => {
    expect(isHttpApiError(httpError(500))).toBe(true);
    expect(isHttpApiError(new GatewayHttpError("down", 503))).toBe(false);
    expect(isGatewayHttpError(new GatewayHttpError("down", 503))).toBe(true);
    expect(isGatewayHttpError(httpError(500))).toBe(false);
    expect(isHttpApiError(new Error("plain"))).toBe(false);
  });

  it("reads HTTP status from any typed transport error, undefined otherwise", () => {
    expect(getErrorStatus(httpError(404))).toBe(404);
    expect(getErrorStatus(new GatewayHttpError("forbidden", 403))).toBe(403);
    expect(getErrorStatus({ status: 418 })).toBe(418);
    expect(getErrorStatus(new Error("transport disconnected"))).toBeUndefined();
    expect(getErrorStatus("nope")).toBeUndefined();
  });

  it("flags auth failures across HTTP status and synthesized auth errors", () => {
    expect(isAuthError(httpError(401))).toBe(true);
    expect(isAuthError(new GatewayHttpError("forbidden", 403))).toBe(true);
    expect(
      isAuthError(
        new ApiClientError("token required", {
          type: ApiClientErrorType.Auth,
          code: ApiClientErrorCode.AuthRequired,
        }),
      ),
    ).toBe(true);
    expect(isAuthError(httpError(404))).toBe(false);
    expect(isAuthError(new Error("network error"))).toBe(false);
  });

  it("recognizes endpoint-not-found errors", () => {
    expect(
      isEndpointNotFoundError(new ApiClientError("no such surface", { code: ApiClientErrorCode.EndpointNotFound })),
    ).toBe(true);
    expect(isEndpointNotFoundError(new Error("other"))).toBe(false);
  });
});

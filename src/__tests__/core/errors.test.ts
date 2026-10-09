import { describe, expect, it } from "vitest";
import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
  getErrorCode,
  getErrorMessage,
  getRuntimeErrorMetadata,
  getErrorStatus,
  getErrorType,
  isAbortError,
  isApiClientError,
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
import { GatewayRpcError } from "../../core/gateway/rpc/error";
import { GatewayJobAbortError, GatewayJobTimeoutError } from "../../core/gateway/jobs";
import { PortalConfigPatchError } from "../../core/gateway/portal/config-patch";
import { GatewayAgentConfigApiError } from "../../core/gateway/agent/config";
import { CapabilityUnavailable } from "../../core/runtime/control-plane/runtime-control-client";
import { CapabilityCallRejected } from "../../contracts/capability-result";
import { resolveTeamRoutePath } from "../../contracts/team-manifest";
import { OpenClawWireError } from "../../providers/openclaw/control-plane/wire";
import { WebhookVerificationError } from "../../providers/claude/managed-agents/webhooks";

describe("core error helpers", () => {
  it.each([
    ["RunFailed", "run_failed"],
    ["RunCancelled", "run_cancelled"],
    ["RunIncomplete", "run_incomplete"],
    ["RunOutputMissing", "run_output_missing"],
  ] as const)("supports portable %s errors without exposing the run in serialization", (name, code) => {
    const run = { run_id: "run-1", status: "failed", error: "private provider details" };
    const error = new ApiClientError("Answer unavailable", {
      type: ApiClientErrorType.Run,
      code: ApiClientErrorCode[name],
      cause: run,
    });
    expect(ApiClientErrorCode[name]).toBe(code);
    expect(isApiClientError(error)).toBe(true);
    expect(error.cause).toBe(run);
    expect(isAbortError(error)).toBe(false);
    expect(isAuthError(error)).toBe(false);
    expect(serializeError(error)).toEqual({
      name: "ApiClientError", message: "Answer unavailable", type: "run", code,
    });
  });

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

  it("preserves safe runtime error metadata without changing serialization", () => {
    const error = new ApiClientError("overloaded", {
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.ServerOverloaded,
      runtime: {
        provider: "codex-app-server",
        transport: "json-rpc",
        operation: "turn/start",
        retryable: true,
        retryAfterMs: 250,
      },
    });

    expect(getRuntimeErrorMetadata(error)).toEqual({
      provider: "codex-app-server",
      transport: "json-rpc",
      operation: "turn/start",
      retryable: true,
      retryAfterMs: 250,
    });
    expect(serializeError(error)).toEqual({
      name: "ApiClientError",
      message: "overloaded",
      type: "transport",
      code: "server_overloaded",
    });
  });

  it("rejects malformed runtime error metadata", () => {
    const valid = {
      provider: "codex-app-server",
      transport: "json-rpc",
      operation: "turn/start",
      retryable: false,
    };
    const malformed = [
      [],
      {},
      { ...valid, provider: " " },
      { ...valid, transport: 1 },
      { ...valid, operation: "" },
      { ...valid, retryable: "false" },
      { ...valid, retryAfterMs: Number.NaN },
      { ...valid, status: Number.POSITIVE_INFINITY },
      { ...valid, providerCode: 429 },
    ];

    for (const runtime of malformed) {
      expect(getRuntimeErrorMetadata({ runtime })).toBeUndefined();
    }
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

describe("single error root", () => {
  const cases: Array<{
    name: string;
    error: Error;
    type: ApiClientErrorType | string;
    code: ApiClientErrorCode | string;
  }> = [
    {
      name: "HttpApiError",
      error: new HttpApiError({ message: "boom", path: "/x", url: "http://h/x", method: "GET", status: 500, body: "" }),
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.HttpRequestFailed,
    },
    {
      name: "GatewayHttpError",
      error: new GatewayHttpError("boom", 502),
      type: ApiClientErrorType.GatewayHttp,
      code: ApiClientErrorCode.GatewayError,
    },
    {
      name: "GatewayRpcError",
      error: new GatewayRpcError("boom", "UNAVAILABLE"),
      type: ApiClientErrorType.GatewayRpc,
      code: "UNAVAILABLE",
    },
    {
      name: "GatewayJobTimeoutError",
      error: new GatewayJobTimeoutError({ attempts: 3, elapsedMs: 900, lastJob: null }),
      type: ApiClientErrorType.Timeout,
      code: ApiClientErrorCode.Timeout,
    },
    {
      name: "GatewayJobAbortError",
      error: new GatewayJobAbortError("stop"),
      type: ApiClientErrorType.Abort,
      code: ApiClientErrorCode.Aborted,
    },
    {
      name: "PortalConfigPatchError",
      error: new PortalConfigPatchError(409, "conflict", null),
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.HttpRequestFailed,
    },
    {
      name: "GatewayAgentConfigApiError",
      error: new GatewayAgentConfigApiError("missing", { status: 404 }),
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.HttpRequestFailed,
    },
    {
      name: "CapabilityUnavailable",
      error: new CapabilityUnavailable("codex", "controlPlane.usage.get"),
      type: ApiClientErrorType.Unknown,
      code: ApiClientErrorCode.CapabilityUnavailable,
    },
    {
      name: "CapabilityCallRejected",
      error: new CapabilityCallRejected("bad input", 400),
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.InvalidRequest,
    },
    {
      name: "OpenClawWireError",
      error: new OpenClawWireError("bad payload"),
      type: ApiClientErrorType.GatewayRpc,
      code: ApiClientErrorCode.ProtocolMismatch,
    },
    {
      name: "WebhookVerificationError",
      error: new WebhookVerificationError("bad signature"),
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.ValidationFailed,
    },
  ];

  it.each(cases)("$name extends ApiClientError with its type and code", ({ name, error, type, code }) => {
    expect(error).toBeInstanceOf(ApiClientError);
    expect(isApiClientError(error)).toBe(true);
    expect(error.name).toBe(name);
    expect(getErrorType(error)).toBe(type);
    expect(getErrorCode(error)).toBe(code);
    expect(serializeError(error)).toMatchObject({ name, type, code });
  });

  it("keeps a gateway-supplied code on GatewayHttpError", () => {
    expect(new GatewayHttpError("nope", 404, "not_found").code).toBe("not_found");
  });

  it("leaves a statusless GatewayAgentConfigApiError untyped", () => {
    const error = new GatewayAgentConfigApiError("invalid payload");
    expect(getErrorType(error)).toBe(ApiClientErrorType.Unknown);
    expect(getErrorCode(error)).toBe(ApiClientErrorCode.Unknown);
  });

  it("treats a gateway job abort as an abort", () => {
    expect(isAbortError(new GatewayJobAbortError())).toBe(true);
  });

  it("throws team manifest failures as InvalidConfig ApiClientErrors", () => {
    let caught: unknown;
    try {
      resolveTeamRoutePath("action", { teamId: "  " });
    } catch (error) {
      caught = error;
    }
    expect(isApiClientError(caught)).toBe(true);
    expect(getErrorType(caught)).toBe(ApiClientErrorType.Configuration);
    expect(getErrorCode(caught)).toBe(ApiClientErrorCode.InvalidConfig);
    expect(getErrorMessage(caught)).toBe("team manifest: missing team id");
  });

  it("rejects non-package errors", () => {
    expect(isApiClientError(new Error("plain"))).toBe(false);
    expect(isApiClientError({ type: "http", code: "x" })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  CapabilityCallRejected,
  classifyCapabilityFailure,
  gapResult,
  liveResult,
} from "../../contracts/capability-result.js";
import { GatewayHttpError } from "../../core/http/gateway-error.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";

const params = {
  area: "capability:kanban",
  expectedContract: "client.kanban.listBoards()",
  call: "client.kanban.listBoards()",
};

function statusError(status: number, message = `HTTP ${status}`): Error {
  return Object.assign(new Error(message), { status });
}

describe("capability result helpers", () => {
  it("liveResult / gapResult produce the discriminated shapes", () => {
    expect(liveResult(42)).toEqual({ ok: true, data: 42, source: "live" });
    const gap = { area: "a", expectedContract: "b", note: "c" };
    expect(gapResult(gap)).toEqual({ ok: false, data: null, gap });
  });
});

describe("classifyCapabilityFailure", () => {
  it("rethrows auth errors (401/403)", () => {
    for (const status of [401, 403]) {
      expect(() =>
        classifyCapabilityFailure({ ...params, error: statusError(status) }),
      ).toThrow();
    }
  });

  it("maps 4xx caller errors (not 401/403/404) to request-invalid", () => {
    const gap = classifyCapabilityFailure({ ...params, error: statusError(400, "bad model") });
    expect(gap.reason).toBe("request-invalid");
    expect(gap.httpStatus).toBe(400);
    expect(gap.note).toContain("bad model");
  });

  it("maps CapabilityCallRejected to request-invalid", () => {
    const gap = classifyCapabilityFailure({
      ...params,
      error: new CapabilityCallRejected("Hermes streaming requires a sessionKey"),
    });
    expect(gap.reason).toBe("request-invalid");
    expect(gap.note).toContain("sessionKey");
  });

  it("maps 404 to endpoint-not-found and 502/503 to backend-unavailable", () => {
    expect(classifyCapabilityFailure({ ...params, error: statusError(404) }).reason).toBe(
      "endpoint-not-found",
    );
    expect(classifyCapabilityFailure({ ...params, error: statusError(503) }).reason).toBe(
      "backend-unavailable",
    );
  });

  it("maps transport failures via the envelope classifier", () => {
    const gap = classifyCapabilityFailure({
      ...params,
      error: new Error("fetch failed: ECONNREFUSED"),
    });
    expect(gap.reason).toBe("backend-unavailable");
  });

  it("rethrows unknown-classified errors", () => {
    expect(() =>
      classifyCapabilityFailure({ ...params, error: new Error("totally novel condition") }),
    ).toThrow("totally novel condition");
  });

  it("maps a statusless ApiClientError(ValidationFailed) to request-invalid (F9)", () => {
    const gap = classifyCapabilityFailure({
      ...params,
      error: new ApiClientError('team directory: unknown team "nope"', {
        code: ApiClientErrorCode.ValidationFailed,
      }),
    });
    expect(gap.reason).toBe("request-invalid");
    expect(gap.note).toContain("unknown team");
  });

  it("maps a statusless ApiClientError(InvalidRequest) to request-invalid (F9)", () => {
    const gap = classifyCapabilityFailure({
      ...params,
      error: new ApiClientError("bad request shape", {
        code: ApiClientErrorCode.InvalidRequest,
      }),
    });
    expect(gap.reason).toBe("request-invalid");
  });

  it("maps a statusless ApiClientError(EndpointNotFound) to endpoint-not-found (F9)", () => {
    const gap = classifyCapabilityFailure({
      ...params,
      error: new ApiClientError("surface unavailable", {
        code: ApiClientErrorCode.EndpointNotFound,
      }),
    });
    expect(gap.reason).toBe("endpoint-not-found");
  });

  it("maps a duck-typed code on a plain Error (e.g. GatewayRpcError) to request-invalid (M2)", () => {
    // GatewayRpcError is a plain Error subclass carrying the server code
    // verbatim — no `instanceof ApiClientError`. A statusless, neutral-message
    // error must still map by its `.code` (via getErrorCode), not fall through.
    const error = Object.assign(new Error("rpc rejected"), { code: "validation_failed" });
    const gap = classifyCapabilityFailure({ ...params, error });
    expect(gap.reason).toBe("request-invalid");
    expect(gap.httpStatus).toBeUndefined();
  });

  it("maps a duck-typed endpoint_not_found code on a plain Error to endpoint-not-found (M2)", () => {
    const error = Object.assign(new Error("no such method"), { code: "endpoint_not_found" });
    expect(classifyCapabilityFailure({ ...params, error }).reason).toBe("endpoint-not-found");
  });

  it("still rethrows a statusless ApiClientError with a non-caller code (F9)", () => {
    // A code outside the caller-input set is NOT mapped by the new block: it
    // falls through to classifyFallbackError, and a novel message classifies as
    // `unknown`, keeping the rethrow carve-out (not a request-invalid gap).
    expect(() =>
      classifyCapabilityFailure({
        ...params,
        error: new ApiClientError("novel condition xyz", {
          code: ApiClientErrorCode.Conflict,
        }),
      }),
    ).toThrow("novel condition xyz");
  });

  it("maps GatewayHttpError 429 to request-invalid (diverges from classifyFallbackError)", () => {
    const gap = classifyCapabilityFailure({
      ...params,
      error: new GatewayHttpError("Too Many Requests", 429),
    });
    expect(gap.reason).toBe("request-invalid");
    expect(gap.httpStatus).toBe(429);
  });

  it("maps status 500 exactly to backend-unavailable", () => {
    expect(classifyCapabilityFailure({ ...params, error: statusError(500) }).reason).toBe(
      "backend-unavailable",
    );
  });

  it("rethrows null/undefined errors", () => {
    expect(() => classifyCapabilityFailure({ ...params, error: null })).toThrow();
    expect(() => classifyCapabilityFailure({ ...params, error: undefined })).toThrow();
  });

  it("rethrows non-finite status errors instead of leaking httpStatus: Infinity", () => {
    expect(() =>
      classifyCapabilityFailure({ ...params, error: statusError(Infinity) }),
    ).toThrow();
    expect(() =>
      classifyCapabilityFailure({
        ...params,
        error: Object.assign(new Error("nan status"), { status: NaN }),
      }),
    ).toThrow();
  });
});

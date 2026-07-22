import { describe, expect, it } from "vitest";
import {
  CapabilityCallRejected,
  classifyCapabilityFailure,
  gapResult,
  liveResult,
} from "../../contracts/capability-result.js";

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
});

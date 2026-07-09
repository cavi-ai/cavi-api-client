import { describe, expect, it } from "vitest";
import { loadOperatorControlSection } from "../../../../extensions/cavi/operator-control/load-section";
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../../../core/errors";
import { GatewayHttpError } from "../../../../core/http/gateway-error";

const base = {
  key: "status" as const,
  fallback: () => ({ ok: false }),
  authoritative: true,
  sampleLimit: null,
  expectedContract: "WS operator.snapshot",
  note: "Operator status unavailable",
};

describe("loadOperatorControlSection — auth invariant (A4)", () => {
  it("rethrows a GatewayHttpError 401/403 instead of degrading", async () => {
    await expect(
      loadOperatorControlSection({ ...base, run: async () => { throw new GatewayHttpError("forbidden", 403); } }),
    ).rejects.toThrow(GatewayHttpError);
  });
  it("rethrows a synthesized Auth-typed ApiClientError instead of degrading", async () => {
    await expect(
      loadOperatorControlSection({ ...base, run: async () => { throw new ApiClientError("session expired", { type: ApiClientErrorType.Auth }); } }),
    ).rejects.toThrow(ApiClientError);
  });
  it("rethrows an auth_required-coded ApiClientError instead of degrading", async () => {
    await expect(
      loadOperatorControlSection({ ...base, run: async () => { throw new ApiClientError("login required", { code: ApiClientErrorCode.AuthRequired }); } }),
    ).rejects.toThrow(ApiClientError);
  });
  it("still degrades to fallback for a non-auth failure", async () => {
    const result = await loadOperatorControlSection({ ...base, run: async () => { throw new Error("backend unavailable"); } });
    expect(result.data).toEqual({ ok: false });
    expect(result.status.available).toBe(false);
  });
});

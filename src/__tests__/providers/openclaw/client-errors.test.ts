import { describe, expect, it } from "vitest";
import { OpenClawApiClient } from "../../../providers/openclaw/client";
import { ApiClientError, ApiClientErrorCode, getErrorCode } from "../../../core/errors";

describe("OpenClawApiClient — typed errors (F5)", () => {
  it("getRun throws ValidationFailed for a missing runId", async () => {
    const client = new OpenClawApiClient({ baseUrl: "https://gateway.example" });
    await expect(client.getRun("  ")).rejects.toBeInstanceOf(ApiClientError);
    await expect(client.getRun("  ")).rejects.toMatchObject({ code: ApiClientErrorCode.ValidationFailed });
  });
  it("stopRun throws ValidationFailed for a missing runId", async () => {
    const client = new OpenClawApiClient({ baseUrl: "https://gateway.example" });
    await expect(client.stopRun("")).rejects.toMatchObject({ code: ApiClientErrorCode.ValidationFailed });
  });
  it("resolveRunApproval throws EndpointNotFound", async () => {
    const client = new OpenClawApiClient({ baseUrl: "https://gateway.example" });
    let error: unknown;
    try { await client.resolveRunApproval(); } catch (e) { error = e; }
    expect(getErrorCode(error)).toBe(ApiClientErrorCode.EndpointNotFound);
  });
});

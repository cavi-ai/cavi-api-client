import { describe, expect, it } from "vitest";
import { OpenClawApiClient } from "../../../providers/openclaw/client.js";

describe("OpenClaw canonical status option", () => {
  it.each([["ok", "completed"], ["error", "failed"], ["pending", "running"], ["timeout", "running"], ["aborted", "cancelled"], ["toString", "toString"]])("maps %s to %s while retaining native status and exact text", async (native, canonical) => {
    const rpcClient = { request: async <T>() => ({ status: native, output: "  exact\n", response: "" }) as T };
    const client = new OpenClawApiClient({ baseUrl: "http://gateway.test", rpcClient, normalizeRunStatus: true });
    expect(await client.getRun("run")).toMatchObject({ status: canonical, provider_status: native, output: "  exact\n", response: "" });
    const legacy = new OpenClawApiClient({ baseUrl: "http://gateway.test", rpcClient });
    expect(await legacy.getRun("run")).toMatchObject({ status: native, output: "exact" });
  });
});

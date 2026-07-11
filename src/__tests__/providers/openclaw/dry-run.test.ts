import { describe, expect, it, vi } from "vitest";
import { OpenClawApiClient } from "../../../providers/openclaw/client";

describe("OpenClawApiClient.startRun — dryRun short-circuit (A3)", () => {
  it("dryRun:true makes zero RPC calls and returns a dry_run status", async () => {
    const request = vi.fn(async () => ({ run_id: "should-not-be-used", status: "started" }));
    const client = new OpenClawApiClient({
      baseUrl: "https://gateway.example",
      rpcClient: { request },
    });

    const status = await client.startRun({ input: "hi", dryRun: true });

    expect(request).not.toHaveBeenCalled();
    expect(status.status).toBe("dry_run");
    expect(status.object).toBe("openclaw.run");
  });
});

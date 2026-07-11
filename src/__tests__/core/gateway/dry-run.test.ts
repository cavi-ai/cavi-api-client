import { describe, expect, it, vi } from "vitest";
import { GatewayApiClient } from "../../../core/gateway/client/client";

describe("GatewayApiClient.startRun — dryRun short-circuit (A3)", () => {
  it("dryRun:true makes zero network calls and returns a dry_run status", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ run_id: "should-not-be-used", status: "started" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new GatewayApiClient({ baseUrl: "https://gw.example", fetchImpl: fetchImpl as unknown as typeof fetch });

    const status = await client.startRun({ input: "hi", model: "agent-default", dryRun: true });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(status.status).toBe("dry_run");
    expect(status.model).toBe("agent-default");
    expect(status.tokens).toBeUndefined();
  });
});

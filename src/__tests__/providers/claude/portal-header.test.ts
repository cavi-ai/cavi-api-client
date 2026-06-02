import { describe, expect, it, vi } from "vitest";
import { ClaudeApiClient } from "../../../providers/claude/client";
import { GatewayApiClient } from "../../../core/gateway/client/client";

function captureHeaders() {
  const calls: Record<string, string>[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    calls.push((init?.headers ?? {}) as Record<string, string>);
    return new Response(JSON.stringify({ id: "msg_1", content: [], stop_reason: "end_turn" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("F3: X-Portal-Client-Id is gateway-only", () => {
  it("Claude does not send X-Portal-Client-Id", async () => {
    const { calls, fetchImpl } = captureHeaders();
    await new ClaudeApiClient({ apiKey: "sk", fetchImpl }).startRun({ input: "hi", model: "m" });
    expect(calls[0]?.["X-Portal-Client-Id"]).toBeUndefined();
    expect(calls[0]?.["x-api-key"]).toBe("sk");
  });

  it("the gateway client still sends X-Portal-Client-Id", async () => {
    const { calls, fetchImpl } = captureHeaders();
    await new GatewayApiClient({ baseUrl: "https://gw.example", fetchImpl }).getCapabilities();
    expect(calls[0]?.["X-Portal-Client-Id"]).toBeDefined();
  });
});

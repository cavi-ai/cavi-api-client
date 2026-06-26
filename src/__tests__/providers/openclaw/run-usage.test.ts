import { describe, expect, it } from "vitest";
import {
  OpenClawApiClient,
  type OpenClawRpcTransport,
} from "../../../providers/openclaw/client";

// OpenClaw overrides startRun/getRun and routes the RPC payload through its own
// normalizer (it does NOT call the base GatewayClient), so it must populate the
// provider-agnostic `tokens` itself. These tests guard that wiring.
function rpcReturning(payload: unknown): OpenClawRpcTransport {
  return { request: async () => payload as never };
}

describe("OpenClaw run-status usage normalization", () => {
  it("populates normalized tokens from RPC usage on startRun", async () => {
    const client = new OpenClawApiClient({
      baseUrl: "https://gateway.example",
      rpcClient: rpcReturning({
        run_id: "run_1",
        status: "started",
        usage: { input_tokens: 70, output_tokens: 30 },
      }),
    });

    const status = await client.startRun({ input: "hi" });

    expect(status.usage).toMatchObject({ input_tokens: 70, output_tokens: 30 });
    expect(status.tokens).toMatchObject({
      inputTokens: 70,
      outputTokens: 30,
      totalTokens: 100,
    });
  });

  it("populates normalized tokens on getRun", async () => {
    const client = new OpenClawApiClient({
      baseUrl: "https://gateway.example",
      rpcClient: rpcReturning({
        run_id: "run_1",
        status: "completed",
        usage: { input_tokens: 5, output_tokens: 7 },
      }),
    });

    const status = await client.getRun("run_1");

    expect(status.tokens).toMatchObject({
      inputTokens: 5,
      outputTokens: 7,
      totalTokens: 12,
    });
  });

  it("omits tokens when the run reports no usage", async () => {
    const client = new OpenClawApiClient({
      baseUrl: "https://gateway.example",
      rpcClient: rpcReturning({ run_id: "run_2", status: "completed" }),
    });

    const status = await client.getRun("run_2");

    expect(status.tokens).toBeUndefined();
  });
});

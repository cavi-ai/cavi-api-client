import { describe, expect, it, vi } from "vitest";
import { GatewayApiClient } from "../../../core/gateway/client/client.js";
import { normalizeRuntimeUsage } from "../../../core/runtime/usage.js";

describe("run usage normalization", () => {
  it("normalizeRuntimeUsage maps snake_case + camelCase keys (sanity)", () => {
    expect(
      normalizeRuntimeUsage(
        { input_tokens: 70, output_tokens: 30, totalTokens: 100 },
        "gateway",
      ),
    ).toMatchObject({ inputTokens: 70, outputTokens: 30, totalTokens: 100 });
  });

  it("startRun populates tokens from backend usage", async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return new Response(
          JSON.stringify({
            run_id: "r1",
            status: "running",
            usage: { input_tokens: 70, output_tokens: 30 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ object: "capabilities", platform: "gateway", features: {} }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const client = new GatewayApiClient({ baseUrl: "https://gw.example", fetchImpl });
    const status = await client.startRun({ input: "hi" });

    expect(status.tokens).toMatchObject({
      inputTokens: 70,
      outputTokens: 30,
      totalTokens: 100,
    });
  });

  it("getRun populates tokens from backend usage", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          run_id: "r1",
          status: "completed",
          usage: { input_tokens: 20, output_tokens: 10 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const client = new GatewayApiClient({ baseUrl: "https://gw.example", fetchImpl });
    const status = await client.getRun("r1");

    expect(status.tokens).toMatchObject({
      inputTokens: 20,
      outputTokens: 10,
      totalTokens: 30,
    });
  });

  it("does not overwrite tokens already set by the backend", async () => {
    const existingTokens = { inputTokens: 5, outputTokens: 5, totalTokens: 10 };
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          run_id: "r1",
          status: "completed",
          tokens: existingTokens,
          usage: { input_tokens: 99, output_tokens: 99 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const client = new GatewayApiClient({ baseUrl: "https://gw.example", fetchImpl });
    const status = await client.getRun("r1");

    expect(status.tokens).toEqual(existingTokens);
  });

  it("leaves tokens undefined when backend reports no usage", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ run_id: "r1", status: "running" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const client = new GatewayApiClient({ baseUrl: "https://gw.example", fetchImpl });
    const status = await client.startRun({ input: "hi" });

    expect(status.tokens).toBeUndefined();
  });
});

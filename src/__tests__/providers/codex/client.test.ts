import { describe, expect, it, vi } from "vitest";
import {
  CODEX_DEFAULT_MODEL,
  CodexApiClient,
} from "../../../providers/codex/client";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function mockFetch(...responses: unknown[]): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const json = responses.shift() ?? {};
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch & { calls: FetchCall[] };
  fn.calls = calls;
  return fn;
}

describe("CodexApiClient", () => {
  it("declares a runtime-only capability profile", async () => {
    const client = new CodexApiClient({
      apiKey: "sk-test",
      fetchImpl: mockFetch({ id: "resp_1", status: "queued" }),
    });

    const caps = await client.getRuntimeCapabilities();

    expect(caps.providerKind).toBe("codex-responses");
    expect(caps.auth).toEqual({ type: "bearer", required: true });
    expect(caps.supports.runs).toBe(true);
    expect(caps.supports.streaming).toBe(true);
    expect(caps.supports.teams ?? false).toBe(false);
    expect(caps.supports.media ?? false).toBe(false);
  });

  it("startRun posts a background Responses request with bearer auth and default model", async () => {
    const fetchImpl = mockFetch({
      id: "resp_start",
      status: "queued",
      model: CODEX_DEFAULT_MODEL,
    });
    const client = new CodexApiClient({ apiKey: "sk-test", fetchImpl });

    const status = await client.startRun({
      input: "Plan the frontend work.",
      instructions: "Be concrete.",
      tools: [{ type: "function", name: "record_plan" }],
      metadata: { trace_id: "trace-1" },
    });

    const call = fetchImpl.calls[0]!;
    expect(call.url).toBe("https://api.openai.com/v1/responses");
    expect(call.init?.method).toBe("POST");
    const headers = call.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(call.init?.body));
    expect(body).toMatchObject({
      model: CODEX_DEFAULT_MODEL,
      input: "Plan the frontend work.",
      instructions: "Be concrete.",
      background: true,
      store: true,
      tools: [{ type: "function", name: "record_plan" }],
      metadata: { trace_id: "trace-1" },
    });
    expect(body.stream).toBeUndefined();
    expect(status).toEqual({
      run_id: "resp_start",
      status: "started",
      model: CODEX_DEFAULT_MODEL,
    });
  });

  it("getRun maps Responses status, output text, error, and usage", async () => {
    const fetchImpl = mockFetch({
      id: "resp_done",
      status: "completed",
      model: CODEX_DEFAULT_MODEL,
      output_text: "Implemented.",
      usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
    });
    const client = new CodexApiClient({ apiKey: "sk-test", fetchImpl });

    const status = await client.getRun("resp_done");

    expect(fetchImpl.calls[0]?.url).toBe("https://api.openai.com/v1/responses/resp_done");
    expect(fetchImpl.calls[0]?.init?.method).toBe("GET");
    expect(status).toEqual({
      run_id: "resp_done",
      status: "completed",
      model: CODEX_DEFAULT_MODEL,
      output: "Implemented.",
      usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
      tokens: {
        inputTokens: 12,
        outputTokens: 4,
        totalTokens: 16,
        raw: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
      },
    });
  });

  it("maps failed and incomplete Responses statuses to failed runtime status", async () => {
    const fetchImpl = mockFetch(
      { id: "resp_failed", status: "failed", error: { message: "tool failed" } },
      { id: "resp_incomplete", status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
    );
    const client = new CodexApiClient({ apiKey: "sk-test", fetchImpl });

    await expect(client.getRun("resp_failed")).resolves.toMatchObject({
      run_id: "resp_failed",
      status: "failed",
      error: "tool failed",
    });
    await expect(client.getRun("resp_incomplete")).resolves.toMatchObject({
      run_id: "resp_incomplete",
      status: "failed",
      error: "max_output_tokens",
    });
  });

  it("cancelRun posts to the Responses cancel endpoint and maps the final status", async () => {
    const fetchImpl = mockFetch({ id: "resp_cancel", status: "cancelled" });
    const client = new CodexApiClient({ apiKey: "sk-test", fetchImpl });

    const result = await client.cancelRun("resp_cancel");

    expect(fetchImpl.calls[0]?.url).toBe("https://api.openai.com/v1/responses/resp_cancel/cancel");
    expect(fetchImpl.calls[0]?.init?.method).toBe("POST");
    expect(result).toEqual({ status: "cancelled" });
  });

  it("requires an API key", () => {
    expect(() => new CodexApiClient({ apiKey: " " })).toThrow(/api key is required/u);
  });

  it("normalizes usage into tokens on the run status", async () => {
    const fetchImpl = mockFetch({
      id: "resp_usage",
      status: "completed",
      model: CODEX_DEFAULT_MODEL,
      output_text: "ok",
      usage: {
        input_tokens: 120,
        output_tokens: 30,
        total_tokens: 150,
        input_tokens_details: { cached_tokens: 20 },
      },
    });
    const client = new CodexApiClient({ apiKey: "sk-test", fetchImpl });

    const status = await client.startRun({ input: "hi" });

    expect(status.usage).toMatchObject({ input_tokens: 120, output_tokens: 30 });
    expect(status.tokens).toMatchObject({
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      cacheReadTokens: 20,
    });
  });
});

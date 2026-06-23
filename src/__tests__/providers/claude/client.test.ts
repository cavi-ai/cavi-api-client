import { describe, expect, it, vi } from "vitest";
import { ClaudeApiClient } from "../../../providers/claude/client";
import { ApiClientErrorCode, getErrorCode } from "../../../core/errors";

function mockFetch(json: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(json), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

const ANTHROPIC_MESSAGE = {
  id: "msg_01",
  type: "message",
  role: "assistant",
  model: "claude-opus-4-8",
  content: [{ type: "text", text: "Hi there!" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 5 },
};

describe("ClaudeApiClient", () => {
  it("declares a runtime-only capability profile", async () => {
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: mockFetch(ANTHROPIC_MESSAGE) });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.providerKind).toBe("claude-sdk");
    expect(caps.supports.runs).toBe(true);
    expect(caps.supports.streaming).toBe(true);
    expect(caps.supports.teams ?? false).toBe(false);
    expect(caps.supports.media ?? false).toBe(false);
  });

  it("startRun posts /v1/messages with anthropic auth headers and maps the response", async () => {
    const fetchImpl = mockFetch(ANTHROPIC_MESSAGE);
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl });

    const status = await client.startRun({
      input: "Hello",
      instructions: "Be brief.",
      model: "claude-opus-4-8",
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "claude-opus-4-8",
      system: "Be brief.",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(typeof body.max_tokens).toBe("number");

    expect(status).toMatchObject({
      run_id: "msg_01",
      status: "completed",
      output: "Hi there!",
      model: "claude-opus-4-8",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  });

  it("normalizes Anthropic usage into tokens on the run status", async () => {
    const client = new ClaudeApiClient({
      apiKey: "sk-test",
      fetchImpl: mockFetch({
        id: "msg_usage",
        model: "claude-opus-4-8",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "ok" }],
        usage: {
          input_tokens: 200,
          output_tokens: 60,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 12,
        },
      }),
    });

    const status = await client.startRun({ input: "hi", model: "claude-opus-4-8" });

    expect(status.usage).toMatchObject({ input_tokens: 200, output_tokens: 60 });
    expect(status.tokens).toMatchObject({
      inputTokens: 200,
      outputTokens: 60,
      totalTokens: 260,
      cacheReadTokens: 50,
      cacheWriteTokens: 12,
    });
  });

  it("F1: getRun and cancelRun throw EndpointNotFound (stateless provider)", async () => {
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: mockFetch(ANTHROPIC_MESSAGE) });
    await expect(client.getRun("msg_01")).rejects.toSatisfy(
      (e: unknown) => getErrorCode(e) === ApiClientErrorCode.EndpointNotFound,
    );
    await expect(client.cancelRun("msg_01")).rejects.toSatisfy(
      (e: unknown) => getErrorCode(e) === ApiClientErrorCode.EndpointNotFound,
    );
  });
});

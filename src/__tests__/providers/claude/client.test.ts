import { describe, expect, it, vi } from "vitest";
import { ClaudeApiClient } from "../../../providers/claude/client";
import { ApiClientErrorCode } from "../../../core/errors";

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

  it("dryRun:true short-circuits startRun with zero network calls (A3)", async () => {
    const fetchImpl = mockFetch(ANTHROPIC_MESSAGE);
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl });

    const status = await client.startRun({ input: "hi", model: "claude-opus-4-8", dryRun: true });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(status.status).toBe("dry_run");
    expect(status.model).toBe("claude-opus-4-8");
    expect(status.tokens).toBeUndefined();
    expect(status.output).toBeUndefined();
  });

  it("dryRun:true still validates — missing model throws ValidationFailed", async () => {
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: mockFetch(ANTHROPIC_MESSAGE) });
    await expect(client.startRun({ input: "hi", dryRun: true })).rejects.toMatchObject({
      code: ApiClientErrorCode.ValidationFailed,
    });
  });

  describe("Claude getRun/cancelRun graceful degrade", () => {
    const okMessage = {
      id: "msg_run_1", type: "message", role: "assistant", model: "claude-opus-4-8",
      content: [{ type: "text", text: "ok" }], stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    const fetchImpl = () =>
      (async () =>
        new Response(JSON.stringify(okMessage), {
          status: 200, headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch;

    it("getRun returns the terminal status for a run started via this client", async () => {
      const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: fetchImpl() });
      const started = await client.startRun({ input: "hi", model: "claude-opus-4-8" });
      const got = await client.getRun(started.run_id);
      expect(got.run_id).toBe(started.run_id);
      expect(got.status).toBe(started.status);
    });

    it("getRun returns an honest unknown status (never throws) for a foreign run id", async () => {
      const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: fetchImpl() });
      const got = await client.getRun("msg_not_ours");
      expect(got.status).toBe("unknown");
      expect(got.error).toContain("claude-sdk");
    });

    it("cancelRun is a no-op success that never throws", async () => {
      const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: fetchImpl() });
      const started = await client.startRun({ input: "hi", model: "claude-opus-4-8" });
      await expect(client.cancelRun(started.run_id)).resolves.toEqual({ status: started.status });
      await expect(client.cancelRun("foreign")).resolves.toEqual({ status: "completed" });
    });
  });
});

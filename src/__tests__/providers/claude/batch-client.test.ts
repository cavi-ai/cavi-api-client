import { describe, expect, it, vi } from "vitest";
import { ClaudeApiClient } from "../../../providers/claude/client";

type FetchCall = { url: string; init?: RequestInit };
function router(handlers: (url: string, init?: RequestInit) => Response): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handlers(String(url), init);
  }) as unknown as typeof fetch & { calls: FetchCall[] };
  fn.calls = calls;
  return fn;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("ClaudeApiClient batch", () => {
  it("declares supports.batch", async () => {
    const client = new ClaudeApiClient({ apiKey: "k", fetchImpl: router(() => json({})) });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.supports.batch).toBe(true);
  });

  it("submitBatch posts requests[] to /v1/messages/batches and maps the batch", async () => {
    const fetchImpl = router((url) => {
      expect(url).toBe("https://api.anthropic.com/v1/messages/batches");
      return json({ id: "msgbatch_1", processing_status: "in_progress", request_counts: { processing: 1 } });
    });
    const client = new ClaudeApiClient({ apiKey: "k", fetchImpl });
    const status = await client.submitBatch([{ customId: "a", body: { input: "hi", model: "claude-opus-4-8" } }]);
    const sent = JSON.parse(String(fetchImpl.calls[0]!.init!.body));
    expect(sent.requests).toEqual([{ custom_id: "a", params: { model: "claude-opus-4-8", max_tokens: 4096, messages: [{ role: "user", content: "hi" }] } }]);
    expect(status).toMatchObject({ batch_id: "msgbatch_1", status: "in_progress", resultsAvailable: false });
  });

  it("getBatch and cancelBatch map the batch", async () => {
    const client = new ClaudeApiClient({
      apiKey: "k",
      fetchImpl: router((url) => {
        if (url.endsWith("/cancel")) return json({ id: "b", processing_status: "canceling" });
        return json({ id: "b", processing_status: "ended", request_counts: { succeeded: 1 } });
      }),
    });
    expect(await client.getBatch("b")).toMatchObject({ status: "completed", resultsAvailable: true });
    expect(await client.cancelBatch("b")).toMatchObject({ status: "canceling" });
  });

  it("getBatchResults parses JSONL into results with tokens", async () => {
    const jsonl = JSON.stringify({ custom_id: "a", result: { type: "succeeded", message: { id: "m", model: "x", stop_reason: "end_turn", content: [{ type: "text", text: "ok" }], usage: { input_tokens: 3, output_tokens: 2 } } } });
    const client = new ClaudeApiClient({
      apiKey: "k",
      fetchImpl: router(() => new Response(jsonl, { status: 200, headers: { "content-type": "application/x-jsonl" } })),
    });
    const results = await client.getBatchResults("b");
    expect(results).toMatchObject([{ customId: "a", outcome: "succeeded", run: { output: "ok", tokens: { inputTokens: 3, outputTokens: 2, totalTokens: 5 } } }]);
  });

  it("getBatchResults throws a typed error when results are not ready (404)", async () => {
    const client = new ClaudeApiClient({
      apiKey: "k",
      fetchImpl: router(() => new Response("not found", { status: 404 })),
    });
    await expect(client.getBatchResults("b")).rejects.toThrow(/not available/);
  });
});

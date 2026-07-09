import { describe, expect, it, vi } from "vitest";
import { ApiClientErrorCode } from "../../../core/errors";
import { GeminiApiClient } from "../../../providers/gemini/client";

type Call = { url: string; init?: RequestInit };
function router(handler: (url: string, init?: RequestInit) => Response): typeof fetch & { calls: Call[] } {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as unknown as typeof fetch & { calls: Call[] };
  fn.calls = calls;
  return fn;
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

describe("GeminiApiClient batch", () => {
  it("declares supports.batch", async () => {
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: router(() => json({})) });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.supports.batch).toBe(true);
  });

  it("submitBatch posts inline requests to batchGenerateContent", async () => {
    const fetchImpl = router((url, init) => {
      if (url.includes(":batchGenerateContent")) {
        const body = JSON.parse(String(init!.body));
        expect(body.batch.input_config.requests.requests[0].metadata.key).toBe("a");
        return json({ name: "batches/1", metadata: { state: "JOB_STATE_PENDING" } });
      }
      return json({});
    });
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl });
    const status = await client.submitBatch([{ customId: "a", body: { input: "hi", model: "gemini-2.5-flash" } }]);
    expect(status).toMatchObject({ batch_id: "batches/1", status: "in_progress", resultsAvailable: false });
  });

  it("getBatch and cancelBatch map the batch", async () => {
    const client = new GeminiApiClient({
      apiKey: "k",
      fetchImpl: router((url) => {
        if (url.endsWith(":cancel")) {
          return json({ name: "batches/b", metadata: { state: "JOB_STATE_CANCELLED" } });
        }
        return json({ name: "batches/b", metadata: { state: "JOB_STATE_SUCCEEDED" } });
      }),
    });
    expect(await client.getBatch("b")).toMatchObject({ status: "completed", resultsAvailable: true });
    expect(await client.cancelBatch("b")).toMatchObject({ status: "cancelled" });
  });

  it("getBatchResults reads inline responses", async () => {
    const client = new GeminiApiClient({
      apiKey: "k",
      fetchImpl: router((url) => {
        if (url.includes("/batches/b")) {
          return json({
            name: "batches/b",
            metadata: { state: "JOB_STATE_SUCCEEDED", model: "gemini-2.5-flash" },
            response: {
              inlinedResponses: [
                {
                  metadata: { key: "a" },
                  response: {
                    candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
                    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
                  },
                },
              ],
            },
          });
        }
        return json({});
      }),
    });
    const results = await client.getBatchResults("b");
    expect(results).toMatchObject([
      { customId: "a", outcome: "succeeded", run: { output: "ok", tokens: { inputTokens: 2, outputTokens: 1, totalTokens: 3 } } },
    ]);
  });

  it("getBatchResults downloads file output JSONL", async () => {
    const out = JSON.stringify({
      key: "a",
      response: {
        candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      },
    });
    const client = new GeminiApiClient({
      apiKey: "k",
      fetchImpl: router((url) => {
        if (url.includes("/batches/b")) {
          return json({
            name: "batches/b",
            metadata: { state: "JOB_STATE_SUCCEEDED", model: "gemini-2.5-flash" },
            response: { responsesFile: "files/batch-out" },
          });
        }
        if (url.includes("/download/")) return new Response(out, { status: 200 });
        return json({});
      }),
    });
    const results = await client.getBatchResults("b");
    expect(results[0]).toMatchObject({ customId: "a", outcome: "succeeded", run: { output: "ok" } });
  });

  it("getBatchResults throws when results are not ready", async () => {
    const client = new GeminiApiClient({
      apiKey: "k",
      fetchImpl: router(() => json({ name: "batches/b", metadata: { state: "JOB_STATE_RUNNING" } })),
    });
    await expect(client.getBatchResults("b")).rejects.toThrow(/not available/);
  });

  it("getBatchResults throws on malformed downloaded JSONL", async () => {
    const client = new GeminiApiClient({
      apiKey: "k",
      fetchImpl: router((url) => {
        if (url.includes("/batches/b")) {
          return json({
            name: "batches/b",
            metadata: { state: "JOB_STATE_SUCCEEDED", model: "gemini-2.5-flash" },
            response: { responsesFile: "files/batch-out" },
          });
        }
        if (url.includes("/download/")) return new Response("{bad", { status: 200 });
        return json({});
      }),
    });
    await expect(client.getBatchResults("b")).rejects.toMatchObject({
      code: ApiClientErrorCode.InvalidJson,
      message: "gemini: invalid batch JSONL at line 1",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { ApiClientErrorCode } from "../../../core/errors";
import { CodexApiClient } from "../../../providers/codex/client";

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

describe("CodexApiClient batch", () => {
  it("declares supports.batch", async () => {
    const client = new CodexApiClient({ apiKey: "sk", fetchImpl: router(() => json({})) });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.supports.batch).toBe(true);
  });

  it("submitBatch uploads JSONL then creates a /v1/responses batch (24h)", async () => {
    const fetchImpl = router((url, init) => {
      if (url.endsWith("/v1/files")) return json({ id: "file-in", object: "file" });
      if (url.endsWith("/v1/batches")) {
        const body = JSON.parse(String(init!.body));
        expect(body).toEqual({ input_file_id: "file-in", endpoint: "/v1/responses", completion_window: "24h" });
        return json({ id: "batch_1", status: "in_progress", request_counts: { total: 1, completed: 0, failed: 0 } });
      }
      return json({});
    });
    const client = new CodexApiClient({ apiKey: "sk", fetchImpl });
    const status = await client.submitBatch([{ customId: "a", body: { input: "hi", model: "gpt-5-codex" } }]);

    const upload = fetchImpl.calls.find((c) => c.url.endsWith("/v1/files"))!;
    expect((upload.init!.body as FormData).get("purpose")).toBe("batch");
    expect(status).toMatchObject({ batch_id: "batch_1", status: "in_progress", resultsAvailable: false });
  });

  it("getBatch and cancelBatch map the batch", async () => {
    const client = new CodexApiClient({
      apiKey: "sk",
      fetchImpl: router((url) => {
        if (url.endsWith("/cancel")) return json({ id: "b", status: "cancelling" });
        return json({ id: "b", status: "completed", output_file_id: "file-out", request_counts: { total: 1, completed: 1, failed: 0 } });
      }),
    });
    expect(await client.getBatch("b")).toMatchObject({ status: "completed", resultsAvailable: true });
    expect(await client.cancelBatch("b")).toMatchObject({ status: "canceling" });
  });

  it("getBatchResults downloads + merges output and error files", async () => {
    const out = JSON.stringify({ custom_id: "a", response: { status_code: 200, body: { id: "r", status: "completed", model: "m", output_text: "ok", usage: { input_tokens: 3, output_tokens: 2 } } }, error: null });
    const err = JSON.stringify({ custom_id: "b", response: null, error: { message: "boom" } });
    const client = new CodexApiClient({
      apiKey: "sk",
      fetchImpl: router((url) => {
        if (url.endsWith("/v1/batches/b")) return json({ id: "b", status: "completed", output_file_id: "file-out", error_file_id: "file-err" });
        if (url.endsWith("/v1/files/file-out/content")) return new Response(out, { status: 200 });
        if (url.endsWith("/v1/files/file-err/content")) return new Response(err, { status: 200 });
        return json({});
      }),
    });
    const results = await client.getBatchResults("b");
    expect(results).toMatchObject([
      { customId: "a", outcome: "succeeded", run: { output: "ok", tokens: { inputTokens: 3, outputTokens: 2, totalTokens: 5 } } },
      { customId: "b", outcome: "errored", error: "boom" },
    ]);
  });

  it("getBatchResults throws a typed error when no output/error file yet", async () => {
    const client = new CodexApiClient({
      apiKey: "sk",
      fetchImpl: router(() => json({ id: "b", status: "in_progress" })),
    });
    await expect(client.getBatchResults("b")).rejects.toThrow(/not available/);
  });

  it("getBatchResults throws a typed error when downloaded JSONL is malformed", async () => {
    const client = new CodexApiClient({
      apiKey: "sk",
      fetchImpl: router((url) => {
        if (url.endsWith("/v1/batches/b")) {
          return json({ id: "b", status: "completed", output_file_id: "file-out" });
        }
        if (url.endsWith("/v1/files/file-out/content")) {
          return new Response("{bad json", { status: 200 });
        }
        return json({});
      }),
    });

    await expect(client.getBatchResults("b")).rejects.toMatchObject({
      code: ApiClientErrorCode.InvalidJson,
      message: "codex-responses: invalid batch JSONL at line 1",
    });
  });
});

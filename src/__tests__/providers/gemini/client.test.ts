import { describe, expect, it, vi } from "vitest";
import { GeminiApiClient } from "../../../providers/gemini/client.js";

type FetchCall = { url: string; init?: RequestInit };
function mockFetch(...responses: unknown[]): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const json = responses.shift() ?? {};
    return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch & { calls: FetchCall[] };
  fn.calls = calls;
  return fn;
}

describe("GeminiApiClient", () => {
  it("declares a runtime-only capability profile", async () => {
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: mockFetch({}) });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.providerKind).toBe("gemini");
    expect(caps.auth).toEqual({ type: "api-key", required: true });
    expect(caps.supports.runs).toBe(true);
    expect(caps.supports.streaming).toBe(true);
    expect(caps.supports.teams ?? false).toBe(false);
  });

  it("startRun posts to :generateContent with the model in the path and x-goog-api-key", async () => {
    const fetchImpl = mockFetch({
      candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, totalTokenCount: 150, cachedContentTokenCount: 20 },
      modelVersion: "gemini-2.5-flash",
    });
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl });

    const status = await client.startRun({ input: "hi", model: "gemini-2.5-flash" });

    const call = fetchImpl.calls[0]!;
    expect(call.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(call.init?.method).toBe("POST");
    expect((call.init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    expect(status.run_id).toMatch(/^gemini-/);
    expect(status.status).toBe("completed");
    expect(status.output).toBe("ok");
    expect(status.usage).toMatchObject({ promptTokenCount: 120, candidatesTokenCount: 30 });
    expect(status.tokens).toMatchObject({ inputTokens: 120, outputTokens: 30, totalTokens: 150, cacheReadTokens: 20 });
  });

  it("throws ValidationFailed when no model is given", async () => {
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: mockFetch({}) });
    await expect(client.startRun({ input: "hi" })).rejects.toThrow(/model is required/);
  });

  it("maps a safety block to a failed status", async () => {
    const client = new GeminiApiClient({
      apiKey: "k",
      fetchImpl: mockFetch({ promptFeedback: { blockReason: "SAFETY" } }),
    });
    const status = await client.startRun({ input: "hi", model: "gemini-2.5-flash" });
    expect(status.status).toBe("failed");
    expect(status.error).toBe("SAFETY");
  });

  it("getRun and cancelRun throw EndpointNotFound (synchronous API)", async () => {
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: mockFetch({}) });
    await expect(client.getRun("x")).rejects.toThrow(/unsupported/);
    await expect(client.cancelRun("x")).rejects.toThrow(/unsupported/);
  });

  it("dryRun:true short-circuits startRun with zero network calls (A3)", async () => {
    const fetchImpl = mockFetch({});
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl });

    const status = await client.startRun({ input: "hi", model: "gemini-2.5-flash", dryRun: true });

    expect(fetchImpl.calls).toHaveLength(0);
    expect(status.status).toBe("dry_run");
    expect(status.model).toBe("gemini-2.5-flash");
    expect(status.tokens).toBeUndefined();
    expect(status.output).toBeUndefined();
  });

  it("dryRun:true still validates — missing model throws ValidationFailed", async () => {
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: mockFetch({}) });
    await expect(client.startRun({ input: "hi", dryRun: true })).rejects.toThrow(/model is required/);
  });
});

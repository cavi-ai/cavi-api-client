import { describe, expect, it, vi } from "vitest";
import { AgyApiClient } from "../../../providers/agy/client.js";

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

describe("AgyApiClient", () => {
  it("declares a runtime-only capability profile", async () => {
    const client = new AgyApiClient({
      baseUrl: "https://api.antigravity.google",
      apiKey: "sk-test",
      fetchImpl: mockFetch({ run_id: "agy_1", status: "completed" }),
    });

    const caps = await client.getRuntimeCapabilities();

    expect(caps.providerKind).toBe("agy");
    expect(caps.auth).toEqual({ type: "api-key", required: true });
    expect(caps.supports.runs).toBe(true);
    expect(caps.supports.streaming).toBe(true);
    expect(caps.supports.teams ?? false).toBe(false);
  });

  it("startRun posts a request to the AGY orchestration endpoint", async () => {
    const fetchImpl = mockFetch({
      run_id: "agy_start",
      status: "completed",
      result: { output: "Test output" }
    });
    const client = new AgyApiClient({
      baseUrl: "https://api.antigravity.google",
      apiKey: "sk-test",
      cache: "reload",
      credentials: "include",
      defaultTimeoutMs: 25,
      fetchImpl,
    });

    const status = await client.startRun({
      input: "Execute the plan.",
      model: "agy-agent-1",
    });

    const call = fetchImpl.calls[0]!;
    expect(call.url).toBe("https://api.antigravity.google/v1/agents/run");
    expect(call.init?.method).toBe("POST");
    const headers = call.init?.headers as Record<string, string>;
    expect(headers["x-agy-api-key"]).toBe("sk-test");
    expect(call.init?.cache).toBe("reload");
    expect(call.init?.credentials).toBe("include");
    expect(call.init?.signal).toBeInstanceOf(AbortSignal);
    expect(call.init?.signal?.aborted).toBe(false);
    const body = JSON.parse(String(call.init?.body));
    expect(body).toMatchObject({
      agent_id: "agy-agent-1",
      context: { query: "Execute the plan." },
      stream: false,
    });
    expect(status).toEqual({
      run_id: "agy_start",
      status: "completed",
      model: "agy-agent-1",
      output: "Test output",
    });
  });

  it("aborts an in-flight startRun request at the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
        requestSignal = init?.signal;
        if (!requestSignal) throw new Error("missing request signal");
        return await new Promise<Response>((_resolve, reject) => {
          requestSignal!.addEventListener("abort", () => {
            reject(requestSignal!.reason ?? new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }) as unknown as typeof fetch;
      const client = new AgyApiClient({
        baseUrl: "https://api.antigravity.google",
        apiKey: "sk-test",
        defaultTimeoutMs: 25,
        fetchImpl,
      });

      const pending = expect(client.startRun({ input: "hi", model: "agy-agent-1" }))
        .rejects.toThrow(/POST \/v1\/agents\/run failed/u);
      await vi.advanceTimersByTimeAsync(25);

      await pending;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  describe("synchronous lifecycle compatibility", () => {
    const response = {
      run_id: "agy-sync-1",
      status: "completed",
      result: { output: "ok" },
    };

    it("returns a successful startRun result from getRun", async () => {
      const client = new AgyApiClient({
        baseUrl: "https://api.antigravity.google",
        apiKey: "sk-test",
        fetchImpl: mockFetch(response),
      });

      const started = await client.startRun({ input: "hi", model: "agy-agent-1" });
      await expect(client.getRun(started.run_id)).resolves.toEqual(started);
    });

    it("returns unknown for a foreign run and completed when cancelling either run", async () => {
      const client = new AgyApiClient({
        baseUrl: "https://api.antigravity.google",
        apiKey: "sk-test",
        fetchImpl: mockFetch(response),
      });

      const started = await client.startRun({ input: "hi", model: "agy-agent-1" });
      await expect(client.getRun("agy-foreign")).resolves.toMatchObject({
        run_id: "agy-foreign",
        status: "unknown",
      });
      await expect(client.cancelRun(started.run_id)).resolves.toEqual({ status: "completed" });
      await expect(client.cancelRun("agy-foreign")).resolves.toEqual({ status: "completed" });
    });
  });

  it("requires a baseUrl", () => {
    expect(() => new AgyApiClient({ baseUrl: " ", apiKey: "key" })).toThrow(/baseUrl is required/u);
  });

  it("dryRun:true short-circuits startRun with zero network calls", async () => {
    const fetchImpl = mockFetch({ run_id: "agy_1", status: "completed" });
    const client = new AgyApiClient({ baseUrl: "https://api.antigravity.google", apiKey: "sk-test", fetchImpl });

    const status = await client.startRun({ input: "hi", model: "agy-test", dryRun: true });

    expect(fetchImpl.calls).toHaveLength(0);
    expect(status.status).toBe("dry_run");
    expect(status.model).toBe("agy-test");
  });
});

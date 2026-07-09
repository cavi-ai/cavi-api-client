import { describe, it, vi } from "vitest";
import { GeminiApiClient } from "../../../providers/gemini/client";
import {
  ALL_RUNTIME_CONFORMANCE_CHECKS,
  type RuntimeConformanceContext,
} from "../../support/runtime-conformance";

const RESPONSE = {
  candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
  modelVersion: "gemini-2.5-flash",
};

const SSE = [
  'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"ok"}]}}]}\n\n',
  'data: {"candidates":[{"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":1,"totalTokenCount":2}}\n\n',
];

function sseStream(blocks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const b of blocks) c.enqueue(encoder.encode(b));
      c.close();
    },
  });
}

function geminiFetch(): typeof fetch {
  return vi.fn(async (url: unknown, init?: RequestInit) => {
    const target = String(url);
    if (target.includes(":streamGenerateContent")) {
      return new Response(sseStream(SSE), { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    if (target.includes(":batchGenerateContent")) {
      return new Response(
        JSON.stringify({ name: "batches/conformance", metadata: { state: "JOB_STATE_SUCCEEDED", model: "gemini-2.5-flash" }, response: { inlinedResponses: [{ metadata: { key: "a" }, response: RESPONSE }] } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (target.includes("/batches/")) {
      return new Response(
        JSON.stringify({ name: "batches/conformance", metadata: { state: "JOB_STATE_SUCCEEDED", model: "gemini-2.5-flash" }, response: { inlinedResponses: [{ metadata: { key: "a" }, response: RESPONSE }] } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify(RESPONSE), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

function countingFetch(base: typeof fetch): { fetchImpl: typeof fetch; callCount: () => number } {
  let calls = 0;
  const fetchImpl = (async (...args: Parameters<typeof fetch>) => {
    calls += 1;
    return base(...args);
  }) as typeof fetch;
  return { fetchImpl, callCount: () => calls };
}

const ctx: RuntimeConformanceContext = {
  makeClient: () => new GeminiApiClient({ apiKey: "k", fetchImpl: geminiFetch() }),
  runBody: { input: "hi", model: "gemini-2.5-flash" },
  streamRunBody: { input: "hi", model: "gemini-2.5-flash" },
  batchRequests: [{ customId: "a", body: { input: "hi", model: "gemini-2.5-flash" } }],
  makeInstrumentedClient: () => {
    const { fetchImpl, callCount } = countingFetch(geminiFetch());
    return { client: new GeminiApiClient({ apiKey: "k", fetchImpl }), callCount };
  },
  dryRunInvalidRunBody: { input: "hi" }, // no model — must still throw ValidationFailed
};

describe("Gemini provider — runtime conformance", () => {
  for (const check of ALL_RUNTIME_CONFORMANCE_CHECKS) {
    it(check.name, () => check.run(ctx));
  }
});

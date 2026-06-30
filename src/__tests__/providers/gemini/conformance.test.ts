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
  return vi.fn(async (url: unknown) => {
    if (String(url).includes(":streamGenerateContent")) {
      return new Response(sseStream(SSE), { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    return new Response(JSON.stringify(RESPONSE), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

const ctx: RuntimeConformanceContext = {
  makeClient: () => new GeminiApiClient({ apiKey: "k", fetchImpl: geminiFetch() }),
  runBody: { input: "hi", model: "gemini-2.5-flash" },
  streamRunBody: { input: "hi", model: "gemini-2.5-flash" },
};

describe("Gemini provider — runtime conformance", () => {
  for (const check of ALL_RUNTIME_CONFORMANCE_CHECKS) {
    it(check.name, () => check.run(ctx));
  }
});

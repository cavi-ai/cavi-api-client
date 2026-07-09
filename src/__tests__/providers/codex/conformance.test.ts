import { describe, it, vi } from "vitest";
import { CodexApiClient } from "../../../providers/codex/client";
import {
  ALL_RUNTIME_CONFORMANCE_CHECKS,
  type RuntimeConformanceContext,
} from "../../support/runtime-conformance";

const RESPONSE = {
  id: "resp_conf",
  status: "completed",
  model: "gpt-5-codex",
  output_text: "ok",
  usage: { input_tokens: 1, output_tokens: 1 },
};

const SSE = [
  'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_conf"}}\n\n',
  'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"ok"}\n\n',
  'event: response.completed\ndata: {"type":"response.completed","response":{"output_text":"ok"}}\n\n',
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

const BATCH_OBJECT = {
  id: "batch_conf",
  status: "in_progress",
  request_counts: { total: 1, completed: 0, failed: 0 },
};

function codexFetch(): typeof fetch {
  return vi.fn(async (url: unknown, init?: RequestInit) => {
    const urlStr = String(url);
    // Batch file upload
    if (urlStr.endsWith("/v1/files")) {
      return new Response(JSON.stringify({ id: "file-conf", object: "file" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    // Batch create
    if (urlStr.endsWith("/v1/batches") && init?.method === "POST") {
      return new Response(JSON.stringify(BATCH_OBJECT), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    // Batch retrieve (GET /v1/batches/:id)
    if (urlStr.includes("/v1/batches/")) {
      return new Response(JSON.stringify(BATCH_OBJECT), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (body.stream === true) {
      return new Response(sseStream(SSE), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    return new Response(JSON.stringify(RESPONSE), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const ctx: RuntimeConformanceContext = {
  makeClient: () => new CodexApiClient({ apiKey: "sk-test", fetchImpl: codexFetch() }),
  runBody: { input: "hi" },
  streamRunBody: { input: "hi" },
  batchRequests: [{ customId: "conf-1", body: { input: "hi", model: "gpt-5-codex" } }],
};

describe("Codex provider — runtime conformance", () => {
  for (const check of ALL_RUNTIME_CONFORMANCE_CHECKS) {
    it(check.name, () => check.run(ctx));
  }
});

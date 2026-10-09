import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createApiClient, createCapabilityClient, createRuntimeProviderRegistry, isApiClientError, isAuthError } from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";
import { streamText } from "./runtime-streaming.js";

function fixture(t: TestContext, frames: [string, unknown][], status = 200) {
  let requests = 0;
  const client = createApiClient("codex", {
    registry: createRuntimeProviderRegistry({ modules: [createCodexProviderModule({ apiKey: "fixture-key" })] }),
    fetchImpl: async (_url, init) => {
      requests += 1;
      assert.equal(init?.method, "POST");
      assert.equal(JSON.parse(String(init?.body)).stream, true);
      if (status !== 200) return Response.json({}, { status });
      const events: [string, unknown][] = [["response.created", { response: { id: "stream-1" } }], ...frames];
      return new Response(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(""), {
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  });
  t.after(() => client.dispose());
  let partial = "";
  const collect = () => streamText(client, { model: "server-model", input: "Question" },
    (delta) => { partial += delta; }, new AbortController().signal);
  return { collect, requests: () => requests, partial: () => partial };
}

test("uses the final snapshot without appending it as a duplicate delta", async (t) => {
  const app = fixture(t, [
    ["response.output_text.delta", { delta: "Partial" }],
    ["response.completed", { response: { output_text: "Final answer" } }],
  ]);
  assert.equal((await app.collect()).text, "Final answer");
  assert.equal(app.partial(), "Partial");
  assert.equal((await app.collect()).text, "Final answer", "the helper must leave its borrowed client usable");
  assert.equal(app.requests(), 2);
});

test("uses observed deltas when completion has no snapshot", async (t) => {
  const app = fixture(t, [
    ["response.output_text.delta", { delta: "An " }],
    ["response.output_text.delta", { delta: "answer" }],
    ["response.completed", { response: {} }],
  ]);
  const answer = await app.collect();
  assert.equal(answer.outcome, "completed");
  assert.equal(answer.text, "An answer");
  assert.equal(answer.runId, "stream-1");
});

test("preserves an explicitly supplied empty normalized snapshot", async (t) => {
  // The pinned Codex adapter omits empty native text. Exercise the shared
  // contract directly for adapters that supply an explicit empty snapshot.
  const client = createCapabilityClient({ providerKind: "fixture", fallbackSupports: { streaming: true }, runtime: {
    getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: { streaming: true } }),
    startRun: async () => ({ run_id: "unused", status: "completed" }),
    streamRun: async (_body, handlers) => {
      handlers.onEvent({ event: "message.delta", runId: "stream-1", delta: "Partial" });
      handlers.onEvent({ event: "run.completed", runId: "stream-1", output: "" });
    },
  } });
  t.after(() => client.dispose());
  const answer = await streamText(client, { input: "Question" }, () => {}, new AbortController().signal);
  assert.equal(answer.text, "");
});

test("rejects completion with no observed text rather than inventing an empty answer", async (t) => {
  for (const response of [{}, { output_text: "" }]) {
    const app = fixture(t, [["response.completed", { response }]]);
    await assert.rejects(app.collect(), (error) => {
      assert.ok(isApiClientError(error));
      assert.equal(error.type, "run");
      assert.equal(error.code, "run_output_missing");
      assert.equal((error.cause as { runId: string }).runId, "stream-1");
      return true;
    });
  }
});

test("keeps partial output failed, cancelled, or incomplete", async (t) => {
  for (const [event, code] of [["response.failed", "run_failed"], ["response.cancelled", "run_cancelled"], [null, "run_incomplete"]] as const) {
    const frames: [string, unknown][] = [["response.output_text.delta", { delta: "Partial" }]];
    if (event) frames.push([event, { response: { error: { message: "Private execution diagnostic" } } }]);
    const app = fixture(t, frames);
    await assert.rejects(app.collect(), (error) => {
      assert.ok(isApiClientError(error));
      assert.equal(error.code, code);
      assert.equal((error.cause as { runId: string }).runId, "stream-1");
      return true;
    });
    assert.equal(app.partial(), "Partial");
    assert.equal(app.requests(), 1, "a failed stream must not be replayed automatically");
  }
});

test("retains the original availability gap in the typed error", async (t) => {
  const app = fixture(t, [], 503);
  await assert.rejects(app.collect(), (error) => {
    assert.ok(isApiClientError(error));
    assert.equal(error.code, "request_failed");
    assert.equal((error.cause as { reason: string }).reason, "backend-unavailable");
    return true;
  });
  assert.equal(app.requests(), 1);
});

test("keeps provider authentication failures as exceptions", async (t) => {
  const app = fixture(t, [], 401);
  await assert.rejects(app.collect(), isAuthError);
  assert.equal(app.requests(), 1);
});

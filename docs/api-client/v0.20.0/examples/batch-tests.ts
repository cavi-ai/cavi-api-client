import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createApiClient, createRuntimeProviderRegistry, isApiClientError, isAuthError } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";
import { collectBatch } from "./batch-collector.js";

function fixture(t: TestContext, provider: "claude" | "codex", reply: (url: string) => Response) {
  const requests: string[] = [];
  const client = createApiClient(provider, {
    registry: createRuntimeProviderRegistry({ modules: [provider === "claude"
      ? createClaudeProviderModule({ apiKey: "fixture-key" })
      : createCodexProviderModule({ apiKey: "fixture-key" })] }),
    fetchImpl: async (url, init) => {
      assert.equal(init?.method ?? "GET", "GET", "resuming must never submit or cancel work");
      requests.push(String(url));
      return reply(String(url));
    },
  });
  t.after(() => client.dispose());
  return { client, requests };
}

test("keeps an active batch pending without fetching result files", async (t) => {
  const app = fixture(t, "codex", () => Response.json({ id: "saved-1", status: "in_progress" }));
  const result = await collectBatch(app.client, "saved-1");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.kind, "pending");
  assert.equal(result.data.batch.batch_id, "saved-1");
  assert.equal(app.requests.length, 1);
});

test("stops rescheduling known terminal states with no available results", async (t) => {
  for (const status of ["failed", "cancelled", "expired", "completed"]) {
    const app = fixture(t, "codex", () => Response.json({ id: "saved-1", status }));
    const result = await collectBatch(app.client, "saved-1");
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.data.kind, "terminal", status);
    assert.equal(result.data.batch.status, status);
    assert.equal(app.requests.length, 1);
  }
});

test("collects available results even when the batch was cancelled", async (t) => {
  const app = fixture(t, "codex", (url) => url.endsWith("/content")
    ? new Response(JSON.stringify({ custom_id: "one", response: { status_code: 200,
      body: { id: "answer-1", status: "completed", output_text: "Retained answer" },
    } }))
    : Response.json({ id: "saved-1", status: "cancelled", output_file_id: "output-1" }));
  const result = await collectBatch(app.client, "saved-1");
  assert.equal(result.ok, true);
  if (!result.ok || result.data.kind !== "results") return assert.fail("Expected available results");
  assert.equal(result.source, "live");
  assert.equal(result.data.batch.status, "cancelled");
  assert.equal(result.data.items.get("one")?.run?.output, "Retained answer");
  assert.ok(app.requests.every((url) => url.endsWith("/batches/saved-1") || url.endsWith("/files/output-1/content")));
});

function claudeResults(items: unknown[]) {
  return (url: string) => url.endsWith("/results")
    ? new Response(items.map((item) => JSON.stringify(item)).join("\n"))
    : Response.json({ id: "saved-1", processing_status: "ended" });
}

test("correlates out-of-order items and retains every outcome", async (t) => {
  const app = fixture(t, "claude", claudeResults([
    { custom_id: "two", result: { type: "errored", error: { message: "Private item diagnostic" } } },
    { custom_id: "one", result: { type: "succeeded", message: { id: "answer-1", content: [{ type: "text", text: "Answer" }], stop_reason: "end_turn" } } },
    { custom_id: "three", result: { type: "canceled" } },
    { custom_id: "four", result: { type: "expired" } },
    { custom_id: "five", result: { type: "future-outcome" } },
  ]));
  const result = await collectBatch(app.client, "saved-1");
  assert.equal(result.ok, true);
  if (!result.ok || result.data.kind !== "results") return assert.fail("Expected results");
  assert.equal(result.data.batch.batch_id, "saved-1");
  assert.equal(result.data.items.size, 5);
  assert.equal(result.data.items.get("one")?.run?.output, "Answer");
  assert.equal(result.data.items.get("two")?.outcome, "errored");
  assert.equal(result.data.items.get("three")?.outcome, "canceled");
  assert.equal(result.data.items.get("four")?.outcome, "expired");
  assert.equal(result.data.items.get("five")?.outcome, "future-outcome");
});

test("rejects missing or duplicated correlation IDs without overwriting items", async (t) => {
  for (const ids of [["same", "same"], [""], [undefined]]) {
    const app = fixture(t, "claude", claudeResults(ids.map((id) => ({ custom_id: id, result: { type: "canceled" } }))));
    await assert.rejects(collectBatch(app.client, "saved-1"), (error) => {
      assert.ok(isApiClientError(error));
      assert.equal(error.code, "protocol_mismatch");
      assert.equal((error.cause as { batch: { batch_id: string } }).batch.batch_id, "saved-1");
      return true;
    });
  }
});

test("preserves a status retrieval gap", async (t) => {
  const app = fixture(t, "codex", () => Response.json({}, { status: 503 }));
  const result = await collectBatch(app.client, "saved-1");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.gap.reason, "backend-unavailable");
  assert.equal(app.requests.length, 1);
});

test("preserves a result retrieval gap without reporting empty success", async (t) => {
  const app = fixture(t, "claude", (url) => url.endsWith("/results")
    ? Response.json({}, { status: 503 })
    : Response.json({ id: "saved-1", processing_status: "ended" }));
  const result = await collectBatch(app.client, "saved-1");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.gap.reason, "backend-unavailable");
  assert.equal(app.requests.length, 2);
});

test("keeps authentication failures as exceptions", async (t) => {
  const app = fixture(t, "codex", () => Response.json({}, { status: 401 }));
  await assert.rejects(collectBatch(app.client, "saved-1"), isAuthError);
  assert.equal(app.requests.length, 1);
});

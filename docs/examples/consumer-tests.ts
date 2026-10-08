import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";
import { createRunHandler } from "./server-handler.js";

function fixture(t: TestContext, reply: () => Response) {
  const requests: { method: string | undefined; body: Record<string, unknown> }[] = [];
  const diagnostics: unknown[] = [];
  const client = createApiClient("codex", {
    registry: createRuntimeProviderRegistry({
      modules: [createCodexProviderModule({ apiKey: "fixture-key" })],
    }),
    fetchImpl: async (_url, init) => {
      requests.push({ method: init?.method, body: JSON.parse(String(init?.body)) });
      return reply();
    },
  });
  t.after(() => client.dispose());
  const handle = createRunHandler(client, "server-model", (error) => { diagnostics.push(error); });
  return { handle, requests, diagnostics };
}

function question(body: unknown = { input: "Question" }) {
  return new Request("https://application.example/answer", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

test("returns an answer and usage while keeping model selection server-owned", async (t) => {
  const app = fixture(t, () => Response.json({ id: "run-1", status: "completed", output_text: "Answer",
    usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 },
  }));
  const response = await app.handle(question({ input: "Question", model: "caller-model", apiKey: "caller-key" }));
  assert.equal(response.status, 200);
  const answer = await response.json();
  assert.equal(answer.runId, "run-1");
  assert.equal(answer.status, "completed");
  assert.equal(answer.text, "Answer");
  assert.equal(answer.tokens.totalTokens, 7);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].method, "POST");
  assert.equal(app.requests[0].body.input, "Question");
  assert.equal(app.requests[0].body.model, "server-model");
  assert.ok(!("apiKey" in app.requests[0].body));
});

test("returns progress rather than an answer for an active background run", async (t) => {
  const app = fixture(t, () => Response.json({ id: "run-1", status: "queued" }));
  const response = await app.handle(question());
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { runId: "run-1", status: "started" });
});

for (const status of ["failed", "future-state"]) {
  test(`does not report success for ${status} execution state`, async (t) => {
    const app = fixture(t, () => Response.json({ id: "run-1", status,
      error: { message: "Private execution diagnostic" },
    }));
    const response = await app.handle(question());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { runId: "run-1", status });
  });
}

test("returns a controlled response for a backend availability gap", async (t) => {
  const app = fixture(t, () => Response.json({ error: { message: "Private backend diagnostic" } }, { status: 503 }));
  const response = await app.handle(question());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Run unavailable.", reason: "backend-unavailable" });
  assert.equal(app.diagnostics.length, 1);
  assert.equal(app.requests.length, 1, "an ambiguous submission must not be replayed");
});

test("treats provider authentication as server unavailability", async (t) => {
  const app = fixture(t, () => Response.json({ error: { message: "Private authentication diagnostic" } }, { status: 401 }));
  const response = await app.handle(question());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Runtime authentication unavailable." });
  assert.equal(app.diagnostics.length, 1);
  assert.equal(app.requests.length, 1);
});

test("rejects invalid input before starting provider work", async (t) => {
  const app = fixture(t, () => { throw new Error("Invalid input reached the provider"); });
  for (const body of [null, {}, { input: " " }, { input: 42 }]) {
    assert.equal((await app.handle(question(body))).status, 400);
  }
  const malformed = new Request("https://application.example/answer", { method: "POST", body: "{" });
  assert.equal((await app.handle(malformed)).status, 400);
  const wrongMethod = await app.handle(new Request("https://application.example/answer"));
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("Allow"), "POST");
  assert.equal(app.requests.length, 0);
});

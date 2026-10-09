---
documentedVersion: {{documentedVersion}}
---

# Test the behavior your application consumes

Test your application's response policy through the installed package. Replace
only the upstream HTTP response with a fixture; keep the real provider adapter,
capability facade, and application handler in the path.

## Run a complete server contract test

Download [consumer-tests.ts](../examples/consumer-tests.ts) and
[server-handler.ts](../examples/server-handler.ts) into an `examples/` directory.
The tests below exercise the [documented handler](server.md). In your
application, import your actual handler and keep expectations that describe
your caller-facing contract.

Use an ESM Node project with `"type": "module"` in `package.json`. For a
new test workspace:

```sh
npm init -y
npm pkg set type=module
npm install @cavi-ai/api-client@{{documentedVersion}}
npm install --save-dev typescript @types/node
```

After saving both downloads, compile and run them:

```sh
npx tsc --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --strict --skipLibCheck --types node --outDir .consumer-tests \
  examples/consumer-tests.ts examples/server-handler.ts
node --test .consumer-tests/consumer-tests.js
```

Expected result: seven passing tests and a zero exit code. Each test has its
own client and HTTP fixture, and disposes the client through the test cleanup
hook even when an assertion fails. No real provider credentials or network
calls are needed.

```ts
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
```

The success test checks your public answer and normalized usage, and proves
that a caller cannot override the server-selected model or forward a provider
key through the body. The active-run test prevents a background handle from
being displayed as a completed answer. Failed and unknown states remain
failures even when the provider HTTP request itself succeeds.

Gap and authentication tests verify controlled caller messages while the
original diagnostics stay in server telemetry. They also check that an
ambiguous submission is made once. Invalid-input tests fail if provider work
starts before validation.

## Extend coverage for the workflow you own

| Application behavior | Add a check for |
| --- | --- |
| Streaming UI | Partial deltas, failed/cancelled terminal events, missing completion, and controlled error display |
| Background jobs | Stored-owner authorization, retained run IDs, bounded waiting, and explicit cancellation |
| Capability visibility | Supported and unsupported controls; handle the result even after successful discovery |
| Batch workers | Item correlation by custom ID and retention of errored/cancelled/expired items |
| Client ownership | Reuse within a credential scope and shutdown after in-flight work settles |

The [batch collection tests](batching.md#run-the-collection-tests) cover resumed
jobs, terminal states, mixed item outcomes, and ambiguous correlation IDs through
the installed Claude and Codex adapters.

The [streaming tests](streaming.md#run-the-streaming-tests) cover snapshot/delta
handling, missing answers, partial failures, availability gaps, and authentication.

The [authorized background example](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/owned-background-runs.md)
includes development checks for access denial, revocation before polling,
retrieval gaps, and local abort without backend cancellation.

Keep package versions pinned and import public entry points. Source-relative
imports into the SDK can conceal missing published exports or pull Node-only
dependencies into a browser build. The relative import in this test targets
your application's downloaded handler, not SDK internals.

## Test adapters and deployed backends separately

Use `@cavi-ai/api-client/testing` for runner-neutral conformance helpers when
writing a provider adapter. Its [reference](../reference/testing.md) describes
the public inspectors and reports.

These fixtures verify application decisions against native response shapes.
They do not establish that a deployed backend currently has a plugin,
permission, model, or endpoint. Keep deployment integration checks scoped to
the backend and version you actually use; reconcile known work before retrying
ambiguous submissions.

[Compatibility](../concepts/compatibility.md) · [Failure handling](errors.md) ·
[Server integration](server.md)

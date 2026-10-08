import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function verifyOwnedRunExample({ root, consumer, command }) {
  const guide = readFileSync(path.join(root, "docs/guides/owned-background-runs.md"), "utf8");
  const snippets = [...guide.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)];
  const source = readFileSync(path.join(root, "examples/owned-background-runs.ts"), "utf8");
  assert.equal(snippets.length, 1);
  assert.equal(snippets[0][1].trim(), source.trim(), "owned-run example must match its guide");
  writeFileSync(path.join(consumer, "owned-background-runs.ts"), source);
  writeFileSync(path.join(consumer, "tsconfig.owned-runs.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext",
      strict: true, skipLibCheck: true, types: ["node"],
      typeRoots: [path.join(root, "node_modules/@types")],
    },
    files: ["owned-background-runs.ts"],
  }));
  command(path.join(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.owned-runs.json"], consumer);
  writeFileSync(path.join(consumer, "owned-run-journeys.mjs"), `
import assert from "node:assert/strict";
import { createApiClient, createRuntimeProviderRegistry, isAuthError } from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";
import { createOwnedRunService } from "./owned-background-runs.js";

const requests = [];
let states = ["running"];
let revoked = false;
let failAuthorization;
let status = 200;
const canAccess = async (actorId, runId, action) => {
  if (failAuthorization) throw failAuthorization;
  return !revoked && runId === "owned-1" &&
    (actorId === "owner" || (actorId === "reader" && action === "read"));
};
const client = createApiClient("codex", {
  registry: createRuntimeProviderRegistry({ modules: [createCodexProviderModule({ apiKey: "fixture-key" })] }),
  fetchImpl: async (url, init) => {
    requests.push({ url: String(url), method: init?.method ?? "GET" });
    if (status !== 200) return Response.json({ error: { message: "Private backend diagnostic" } }, { status });
    if (init?.method === "POST") {
      assert.equal(String(url), "https://api.openai.com/v1/responses/owned-1/cancel");
      return Response.json({ id: "owned-1", status: "cancelled" });
    }
    assert.equal(String(url), "https://api.openai.com/v1/responses/owned-1");
    const state = states.length > 1 ? states.shift() : states[0];
    if (state === "revoke") revoked = true;
    if (state === "unavailable") return Response.json({}, { status: 503 });
    return Response.json({ id: "owned-1", status: state === "revoke" ? "running" : state,
      ...(state === "completed" ? { output_text: "Answer", usage: { total_tokens: 7 } } : {}),
    });
  },
});
const service = createOwnedRunService(client, canAccess);
const options = { maxPolls: 2, pollIntervalMs: 0, maxWaitMs: 1_000 };
for (const method of ["get", "wait", "cancel"]) {
  for (const [actor, id] of [["stranger", "owned-1"], ["owner", "foreign-1"], ["owner", "missing-1"]]) {
    await assert.rejects(service[method](actor, id, options), { type: "auth", code: "permission_denied", message: "Run access denied." });
  }
}
await assert.rejects(service.cancel("reader", "owned-1"), { code: "permission_denied" });
assert.equal(requests.length, 0, "denied reads, waits, and cancellations must not reach the provider");

const read = await service.get("reader", "owned-1");
assert.equal(read.ok, true);
assert.equal(read.data.status, "running");
assert.equal(requests.length, 1);
requests.length = 0;
const limited = await service.wait("owner", "owned-1", { maxPolls: 0 });
assert.equal(limited.ok, true);
assert.equal(limited.data.reason, "poll-limit");
assert.equal(limited.data.run.run_id, "owned-1");
assert.equal(limited.data.polls, 0);
assert.equal(requests.length, 1, "the initial retrieval precedes the polling budget");

requests.length = 0;
states = ["running", "completed"];
const completed = await service.wait("owner", "owned-1", options);
assert.equal(completed.ok, true);
assert.equal(completed.data.reason, "terminal");
assert.equal(completed.data.run.output, "Answer");
assert.equal(completed.data.run.tokens.totalTokens, 7);
assert.equal(completed.data.polls, 1);
assert.equal(requests.length, 2);
assert.ok(requests.every((request) => request.method === "GET"), "waiting must not submit or cancel work");

requests.length = 0;
states = ["running"];
const aborted = await service.wait("owner", "owned-1", { ...options, signal: AbortSignal.abort() });
assert.equal(aborted.data.reason, "aborted");
assert.equal(aborted.data.polls, 0);
assert.deepEqual(requests.map((request) => request.method), ["GET"]);

requests.length = 0;
states = ["revoke"];
await assert.rejects(service.wait("owner", "owned-1", options), { code: "permission_denied" });
assert.equal(requests.length, 1, "a revoked actor must not reach the provider on the next poll");
revoked = false;

requests.length = 0;
status = 503;
const initialGap = await service.wait("owner", "owned-1", options);
assert.equal(initialGap.ok, false);
assert.equal(initialGap.gap.reason, "backend-unavailable");
assert.equal(requests.length, 1);
status = 200;
states = ["running", "unavailable"];
const laterGap = await service.wait("owner", "owned-1", options);
assert.equal(laterGap.ok, true);
assert.equal(laterGap.data.reason, "gap");
assert.equal(laterGap.data.gap.reason, "backend-unavailable");
assert.equal(laterGap.data.run.status, "running");

status = 401;
await assert.rejects(service.get("owner", "owned-1"), (error) => isAuthError(error));
status = 200;
requests.length = 0;
failAuthorization = new Error("Ownership store unavailable");
await assert.rejects(service.get("owner", "owned-1"), (error) => error === failAuthorization);
assert.equal(requests.length, 0, "authorization lookup errors must fail closed");
failAuthorization = undefined;

const cancellation = await service.cancel("owner", "owned-1");
assert.equal(cancellation.ok, true);
assert.equal(cancellation.data.status, "cancelled");
assert.deepEqual(requests.map((request) => request.method), ["POST"]);
states = ["completed"];
assert.equal((await service.get("owner", "owned-1")).data.status, "completed", "the client remains owned by the application");
await client.dispose();
`);
  command(process.execPath, ["owned-run-journeys.mjs"], consumer);
}

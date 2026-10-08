import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { validateMarkdownLinks } from "./links.mjs";
import { verifyRunResultExamples } from "./run-result-examples.mjs";
import { verifyOwnedRunExample } from "./owned-run-example.mjs";

const root = path.resolve(".");
const temporary = mkdtempSync(path.join(tmpdir(), "cavi-docs-consumer-"));
const command = (executable, args, cwd = root) => execFileSync(executable, args, {
  cwd, encoding: "utf8", stdio: "pipe",
  env: { ...process.env, npm_config_cache: path.join(temporary, "npm-cache") },
});
try {
  const pack = path.join(temporary, "pack");
  const extracted = path.join(temporary, "extracted");
  const consumer = path.join(temporary, "consumer");
  for (const directory of [pack, extracted, consumer]) mkdirSync(directory, { recursive: true });
  command("npm", ["pack", "--ignore-scripts", "--pack-destination", pack]);
  // Lifecycle output can share a line with npm's filename (notably HUSKY=0).
  const archives = readdirSync(pack).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1, "npm pack must create exactly one archive");
  const [name] = archives;
  command("tar", ["-xzf", path.join(pack, name), "-C", extracted]);
  const installed = path.join(consumer, "node_modules/@cavi-ai/api-client");
  mkdirSync(path.dirname(installed), { recursive: true });
  cpSync(path.join(extracted, "package"), installed, { recursive: true });
  writeFileSync(path.join(consumer, "package.json"), '{"type":"module"}\n');
  await validateMarkdownLinks(installed, ["README.md", "MIGRATION.md", "ARCHITECTURE.md"]);

  const readme = readFileSync(path.join(installed, "README.md"), "utf8");
  const snippets = [...readme.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)];
  assert.equal(snippets.length, 1, "README must contain one complete quickstart");
  const fixture = `
import assert from "node:assert/strict";
import { isApiClientError, isAuthError, serializeError } from "@cavi-ai/api-client";
process.env.ANTHROPIC_API_KEY = "fixture-key";
process.env.ANTHROPIC_MODEL = "fixture-model";
let calls = 0;
let response = () => Response.json({ id: "fixture-message", model: "fixture-model", content: [{ type: "text", text: "Check capabilities before using optional features." }], stop_reason: "end_turn", usage: { input_tokens: 3, output_tokens: 4 } });
globalThis.fetch = async (input, init) => {
  calls += 1;
  assert.equal(String(input), "https://api.anthropic.com/v1/messages");
  assert.equal(init.method, "POST");
  assert.equal(JSON.parse(init.body).model, "fixture-model");
  return response();
};
`;
  const packageVersion = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).version;
  const quickstart = readFileSync(path.join(installed, `docs/api-client/v${packageVersion}/introduction/quickstart.md`), "utf8");
  const quickstartSnippet = [...quickstart.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)][0];
  assert.equal(quickstartSnippet?.[1], snippets[0][1], "README and quickstart must teach the same application service");
  const serviceSource = readFileSync(path.join(root, "docs/examples/text-service.ts"), "utf8");
  assert.equal(serviceSource.trim(), snippets[0][1].trim(), "downloadable service must match the README");
  const service = transpileModule(snippets[0][1], { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
  writeFileSync(path.join(consumer, "quickstart.mjs"), fixture + service + `
const assistant = createAssistant({ apiKey: "fixture-key", model: "fixture-model" });
const answer = await assistant.answer("How do I check optional features?");
assert.equal(answer.ok, true);
assert.equal(answer.data.text, "Check capabilities before using optional features.");
assert.equal(answer.data.runId, "fixture-message");
assert.equal(answer.data.tokens.inputTokens, 3);
assert.equal(calls, 1);
await assistant.answer("A second question");
assert.equal(calls, 2, "the service remains usable until its owner disposes it");

response = () => Response.json({ id: "no-text", content: [], stop_reason: "end_turn" });
await assert.rejects(assistant.answer("No text"), (error) => {
  assert.equal(isApiClientError(error), true);
  assert.equal(error.code, "run_output_missing");
  assert.equal(error.type, "run");
  assert.equal(error.cause.run_id, "no-text");
  assert.equal(serializeError(error).cause, undefined);
  return true;
});
response = () => Response.json({ id: "empty-text", content: [{ type: "text", text: "" }], stop_reason: "end_turn" });
// Claude normalizes an empty-only text response to absent output.
await assert.rejects(assistant.answer("Empty provider text"), { code: "run_output_missing" });
response = () => Response.json({ id: "active-run", content: [], stop_reason: null });
await assert.rejects(assistant.answer("No terminal state"), (error) => {
  assert.ok(isApiClientError(error));
  assert.equal(error.code, "run_incomplete");
  assert.equal(error.cause.run_id, "active-run");
  assert.equal(error.cause.status, "running");
  return true;
});
response = () => Response.json({ error: { message: "unavailable" } }, { status: 503 });
const unavailable = await assistant.answer("Unavailable");
assert.equal(unavailable.ok, false);
assert.equal(unavailable.gap.reason, "backend-unavailable");
response = () => Response.json({ error: { message: "bad credential" } }, { status: 401 });
await assert.rejects(assistant.answer("Unauthorized"), isAuthError);
await assistant.dispose();
`);
  command(process.execPath, ["quickstart.mjs"], consumer);

  for (const name of ["runtime-node", "runtime-streaming", "runtime-batch", "gateway-resources", "server-handler"]) {
    const source = readFileSync(path.join(root, `docs/examples/${name}.ts`), "utf8");
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
    writeFileSync(path.join(consumer, `${name}.mjs`), compiled);
  }
  const batchGuide = readFileSync(path.join(installed, `docs/api-client/v${packageVersion}/guides/batching.md`), "utf8");
  const collectionSnippet = [...batchGuide.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)][0];
  assert.ok(collectionSnippet, "batch guide must include its collection function");
  writeFileSync(path.join(consumer, "batch-collector.mjs"), transpileModule(collectionSnippet[1], {
    compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
  }).outputText);
  writeFileSync(path.join(consumer, "journeys.mjs"), `
import assert from "node:assert/strict";
import { ApiClientError, ApiClientErrorCode, createApiClient, createCapabilityClient, createRuntimeProviderRegistry, isApiClientError } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";
import { runAndWait } from "./runtime-node.mjs";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";
import { createRunHandler } from "./server-handler.mjs";
import { streamText } from "./runtime-streaming.mjs";
import { submitBatchAndCollect } from "./runtime-batch.mjs";
import { collectBatch } from "./batch-collector.mjs";
import { listGatewaySessions } from "./gateway-resources.mjs";

// Exercise installed adapters and documented helpers against deterministic wire fixtures.
let requests = [];
const fetchImpl = async (input, init) => {
  requests.push({ url: String(input), method: init?.method ?? "GET" });
  return Response.json(requests.length === 1
    ? { id: "response-1", status: "queued" }
    : { id: "response-1", status: "completed", output_text: "Done" });
};
const codexClient = (fetchImpl) => createApiClient("codex", {
  registry: createRuntimeProviderRegistry({ modules: [createCodexProviderModule({ apiKey: "fixture-key" })] }),
  fetchImpl,
});
const clientWithPolling = codexClient(fetchImpl);
const run = await runAndWait(clientWithPolling, { model: "fixture-model", input: "Summarize this input" }, { maxPolls: 1, pollIntervalMs: 0 });
assert.equal(run.status, "completed");
assert.equal(run.output, "Done");
assert.deepEqual(requests.map((request) => request.method), ["POST", "GET"]);
await clientWithPolling.dispose();

const nativeClient = codexClient(async () => Response.json({ id: "native-response", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "native text" }] }] }));
const nativeOnly = await runAndWait(nativeClient, { model: "fixture-model", input: "Native response" });
assert.equal(nativeOnly.status, "completed");
assert.equal(nativeOnly.output, "native text");
await nativeClient.dispose();

requests = [];
const activeClient = codexClient(async (input, init) => {
  requests.push({ url: String(input), method: init?.method ?? "GET" });
  return Response.json({ id: "response-2", status: "queued" });
});
const activeRun = await runAndWait(activeClient, { model: "fixture-model", input: "Still active" }, { maxPolls: 0 });
assert.equal(activeRun.status, "started");
assert.equal(activeRun.run_id, "response-2");
assert.equal(requests.length, 1, "reaching the local poll limit must not cancel backend work");
await activeClient.cancelRun(activeRun.run_id);
assert.ok(requests[1].url.endsWith("/response-2/cancel"));
await activeClient.dispose();

const registry = createRuntimeProviderRegistry({ modules: [createClaudeProviderModule({ apiKey: "fixture-key" })] });
const client = createApiClient("claude", { registry });
let text = "";
const streamed = await streamText(client, { model: "fixture-model", input: "Validate", dryRun: true }, (delta) => { text += delta; }, AbortSignal.timeout(1_000));
assert.equal(streamed.outcome, "completed");
assert.equal(typeof streamed.text, "string");
const sessions = await listGatewaySessions(client);
assert.equal(sessions.kind, "unavailable");
assert.ok(sessions.gap);
const runtime = {
  getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: {} }),
  startRun: async () => ({ run_id: "unused", status: "unknown" }),
};
const unsupported = createCapabilityClient({ providerKind: "fixture", runtime, fallbackSupports: {} });
await assert.rejects(submitBatchAndCollect(unsupported, []), /batch/);

await client.dispose();

const failedStream = createCapabilityClient({
  providerKind: "fixture", fallbackSupports: { streaming: true },
  runtime: { ...runtime,
    getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: { streaming: true } }),
    streamRun: async (_body, handlers) => { handlers.onEvent({ event: "run.failed", runId: "failed-run", error: "fixture run failed" }); },
  },
});
await assert.rejects(streamText(failedStream, { input: "fail" }, () => {}, AbortSignal.timeout(1_000)), /outcome failed/);
await failedStream.dispose();

for (const [event, code] of [["run.failed", ApiClientErrorCode.RunFailed], ["run.cancelled", ApiClientErrorCode.RunCancelled], [null, ApiClientErrorCode.RunIncomplete]]) {
  const execution = createCapabilityClient({
    providerKind: "fixture", fallbackSupports: { streaming: true },
    runtime: { ...runtime,
      getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: { streaming: true } }),
      streamRun: async (_body, handlers) => {
        handlers.onEvent({ event: "message.delta", runId: "unfinished", delta: "Partial" });
        if (event) handlers.onEvent({ event, runId: "unfinished", error: "private run details" });
      },
    },
  });
  await assert.rejects(streamText(execution, { input: "No completed answer" }, () => {}, AbortSignal.timeout(1_000)), (error) => {
    assert.ok(isApiClientError(error));
    assert.equal(error.code, code);
    assert.equal(error.cause.runId, "unfinished");
    return true;
  });
  await execution.dispose();
}

let polls = 0;
const batch = createCapabilityClient({ providerKind: "fixture", fallbackSupports: { batch: true }, runtime: {
  ...runtime,
  getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: { batch: true } }),
  submitBatch: async () => ({ batch_id: "batch-1", status: "in_progress" }),
  getBatch: async () => { polls += 1; return { batch_id: "batch-1", status: "completed", resultsAvailable: true }; },
  getBatchResults: async () => [{ customId: "one", outcome: "succeeded", run: { run_id: "one", status: "completed" } }, { customId: "two", outcome: "errored", error: "fixture error" }],
} });
const items = await submitBatchAndCollect(batch, [{ customId: "one", body: { input: "one" } }], { maxPolls: 1, pollIntervalMs: 0 });
assert.equal(polls, 1);
assert.deepEqual(items.map((item) => item.outcome), ["succeeded", "errored"]);
const collected = await collectBatch(batch, "batch-1");
assert.equal(collected.data.kind, "results");
assert.equal(collected.data.items.get("one").outcome, "succeeded");
assert.equal(collected.data.items.get("two").outcome, "errored");
await assert.rejects(submitBatchAndCollect(batch, [], { maxPolls: 0 }), /not ready/);
await batch.dispose();

let lastInput;
let runState = "completed";
let providerError;
const diagnostics = [];
const serverClient = createCapabilityClient({
  providerKind: "fixture", fallbackSupports: { runs: true, streaming: true },
  runtime: {
    ...runtime,
    getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: { runs: true, streaming: true } }),
    startRun: async (body) => {
      lastInput = body.input;
      if (providerError) throw providerError;
      return { run_id: "server-run", status: runState, output: "An answer" };
    },
    streamRun: async (_body, handlers) => {
      handlers.onEvent({ event: "message.delta", runId: "stream-run", delta: "Part" });
      handlers.onEvent({ event: "run.completed", runId: "stream-run", output: "The final answer" });
    },
  },
});
const handle = createRunHandler(serverClient, "fixture-model", (error) => diagnostics.push(error));
const request = (body) => new Request("https://app.example/runs", { method: "POST", body: JSON.stringify(body) });
assert.equal((await handle(request({ input: "" }))).status, 400);
assert.equal(lastInput, undefined);
assert.equal((await handle(new Request("https://app.example/runs"))).status, 405);
const response = await handle(request({ input: "A real application question", model: "untrusted-model" }));
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { runId: "server-run", status: "completed", text: "An answer" });
assert.equal(lastInput, "A real application question");
runState = "running";
assert.equal((await handle(request({ input: "Background" }))).status, 202);
runState = "failed";
assert.equal((await handle(request({ input: "Failed run" }))).status, 502);
providerError = new Error("private diagnostics");
const failure = await handle(request({ input: "Rejected" }));
assert.equal(failure.status, 502);
assert.ok(!(await failure.text()).includes("private diagnostics"));
assert.equal(diagnostics[0], providerError);
providerError = new ApiClientError("private credential details", { type: "auth", code: ApiClientErrorCode.AuthRequired });
const authenticationFailure = await handle(request({ input: "Provider authentication" }));
assert.equal(authenticationFailure.status, 503);
assert.ok(!(await authenticationFailure.text()).includes("private credential details"));
assert.equal(diagnostics[1], providerError);
const unavailable = await createRunHandler(unsupported, "fixture-model", (error) => diagnostics.push(error))(request({ input: "Unsupported" }));
assert.equal(unavailable.status, 503);
assert.ok(!(await unavailable.text()).includes("expectedContract"));
let deltas = "";
const final = await streamText(serverClient, { input: "Streaming" }, (delta) => { deltas += delta; }, AbortSignal.timeout(1_000));
assert.equal(deltas, "Part");
assert.equal(final.text, "The final answer");
assert.equal(final.runId, "stream-run");
await serverClient.dispose();

await unsupported.dispose();
`);
  command(process.execPath, ["journeys.mjs"], consumer);
  verifyRunResultExamples({ root, consumer, command });
  verifyOwnedRunExample({ root, consumer, command });
  process.stdout.write("packed documentation quickstart and fixture journeys passed\n");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

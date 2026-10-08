import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { validateMarkdownLinks } from "./links.mjs";

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
  const name = command("npm", ["pack", "--ignore-scripts", "--pack-destination", pack]).trim().split("\n").at(-1);
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
process.env.ANTHROPIC_API_KEY = "fixture-key";
process.env.ANTHROPIC_MODEL = "fixture-model";
let calls = 0;
globalThis.fetch = async (input, init) => {
  calls += 1;
  assert.equal(String(input), "https://api.anthropic.com/v1/messages");
  assert.equal(init.method, "POST");
  assert.equal(JSON.parse(init.body).model, "fixture-model");
  return Response.json({ id: "fixture-message", model: "fixture-model", content: [{ type: "text", text: "Check capabilities before using optional features." }], stop_reason: "end_turn", usage: { input_tokens: 3, output_tokens: 4 } });
};
`;
  writeFileSync(path.join(consumer, "quickstart.mjs"), fixture + snippets[0][1] + '\nassert.equal(calls, 1);\n');
  const output = command(process.execPath, ["quickstart.mjs"], consumer);
  assert.match(output, /Check capabilities before using optional features\./u);

  for (const name of ["runtime-node", "runtime-streaming", "runtime-batch", "gateway-resources"]) {
    const source = readFileSync(path.join(root, `docs/examples/${name}.ts`), "utf8");
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
    writeFileSync(path.join(consumer, `${name}.mjs`), compiled);
  }
  writeFileSync(path.join(consumer, "journeys.mjs"), `
import assert from "node:assert/strict";
import { createApiClient, createCapabilityClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";
import { runQuickstart } from "./runtime-node.mjs";
import { streamText } from "./runtime-streaming.mjs";
import { submitBatchAndCollect } from "./runtime-batch.mjs";
import { listGatewaySessions } from "./gateway-resources.mjs";

// Exercise installed adapters and documented helpers against deterministic wire fixtures.
let requests = [];
const fetchImpl = async (input, init) => {
  requests.push({ url: String(input), method: init?.method ?? "GET" });
  return Response.json(requests.length === 1
    ? { id: "response-1", status: "queued" }
    : { id: "response-1", status: "completed", output_text: "Done" });
};
const run = await runQuickstart("fixture-key", "fixture-model", { fetchImpl, maxPolls: 1, pollIntervalMs: 0 });
assert.equal(run.status, "completed");
assert.equal(run.output, "Done");
assert.deepEqual(requests.map((request) => request.method), ["POST", "GET"]);

const nativeOnly = await runQuickstart("fixture-key", "fixture-model", {
  fetchImpl: async () => Response.json({ id: "native-response", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "native text" }] }] }),
});
assert.equal(nativeOnly.status, "completed");
assert.equal(nativeOnly.output, undefined); // Current mapper does not flatten native output items.

requests = [];
await assert.rejects(runQuickstart("fixture-key", "fixture-model", { maxPolls: 0, fetchImpl: async (input, init) => {
  requests.push({ url: String(input), method: init?.method ?? "GET" });
  return Response.json({ id: "response-2", status: "queued" });
} }), /exceeded the poll limit/);
assert.equal(requests.length, 2);
assert.ok(requests[1].url.endsWith("/response-2/cancel"));

const registry = createRuntimeProviderRegistry({ modules: [createClaudeProviderModule({ apiKey: "fixture-key" })] });
const client = createApiClient("claude", { registry });
let text = "";
const streamed = await streamText(client, { model: "fixture-model", input: "Validate", dryRun: true }, (delta) => { text += delta; }, AbortSignal.timeout(1_000));
assert.equal(streamed.outcome, "completed");
const sessions = await listGatewaySessions(client);
assert.equal(sessions.sessions.length, 0);
assert.ok(sessions.gap);
const runtime = {
  getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: {} }),
  startRun: async () => ({ run_id: "unused", status: "unknown" }),
};
const unsupported = createCapabilityClient({ providerKind: "fixture", runtime, fallbackSupports: {} });
await assert.rejects(submitBatchAndCollect(unsupported, []), /batch/);
await unsupported.dispose();
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
await assert.rejects(submitBatchAndCollect(batch, [], { maxPolls: 0 }), /not ready/);
await batch.dispose();
`);
  command(process.execPath, ["journeys.mjs"], consumer);
  process.stdout.write("packed documentation quickstart and fixture journeys passed\n");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Test the unreleased examples against the already-packed development package. */
export function verifyRunResultExamples({ root, consumer, command }) {
  const guide = readFileSync(path.join(root, "docs/guides/run-results.md"), "utf8");
  const snippets = [...guide.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)];
  const names = ["answer-service", "stream-answer"];
  assert.equal(snippets.length, names.length);
  for (const [index, name] of names.entries()) {
    const example = readFileSync(path.join(root, `examples/${name}.ts`), "utf8");
    assert.equal(snippets[index][1].trim(), example.trim(), `${name} must match its guide`);
    writeFileSync(path.join(consumer, `${name}.ts`), snippets[index][1]);
  }
  writeFileSync(path.join(consumer, "run-result-types.ts"), `
import { requireCompletedRun, requireCompletedStream, type RuntimeRunStatus, type RunStreamOutcome } from "@cavi-ai/api-client";
import { requireRunText, requireStreamText } from "@cavi-ai/api-client/core/runtime";
declare const run: RuntimeRunStatus & { sessionKey: string };
const completedRun = requireCompletedRun(run);
const runStatus: "completed" = completedRun.status;
const sessionKey: string = completedRun.sessionKey;
const text: string = requireRunText(completedRun);
// Completion alone does not require output (tool-only runs are valid).
// @ts-expect-error output remains optional
const requiredOutput: string = completedRun.output;
declare const stream: RunStreamOutcome & { output?: string; diagnostic: unknown };
const completedStream = requireCompletedStream(stream);
const outcome: "completed" = completedStream.outcome;
const runId: string | null = completedStream.runId;
const streamText: string = requireStreamText(completedStream);
// Text helpers accept caller diagnostics without losing them from error causes.
requireStreamText({ runId: null, outcome: "completed", output: "", diagnostic: new Error("detail") });
requireRunText({ run_id: "extended", status: "completed", output: "", sessionKey: "session" });
`);
  writeFileSync(path.join(consumer, "tsconfig.run-results.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext",
      strict: true, skipLibCheck: true, types: ["node"],
      typeRoots: [path.join(root, "node_modules/@types")],
    },
    files: [...names.map((name) => `${name}.ts`), "run-result-types.ts"],
  }));
  command(path.join(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.run-results.json"], consumer);
  writeFileSync(path.join(consumer, "run-result-journeys.mjs"), `
import assert from "node:assert/strict";
import { ApiClientError, ApiClientErrorCode, createCapabilityClient, isApiClientError } from "@cavi-ai/api-client";
import { createAnswerService } from "./answer-service.js";
import { streamAnswer } from "./stream-answer.js";
let state = "completed";
let output = "An answer";
let rejection;
let events = [];
let starts = 0;
let lastInput;
const runtime = {
  getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: { runs: true, streaming: true } }),
  startRun: async (body) => {
    starts += 1;
    lastInput = body.input;
    assert.equal(body.model, "fixture-model");
    if (rejection) throw rejection;
    return { run_id: "answer-1", status: state, output, tokens: { inputTokens: 3, outputTokens: 4 } };
  },
  streamRun: async (_body, handlers) => {
    for (const event of events) handlers.onEvent(event);
  },
};
const client = createCapabilityClient({ providerKind: "fixture", runtime, fallbackSupports: { runs: true, streaming: true } });
const service = createAnswerService(client, "fixture-model");
assert.deepEqual((await service.answer("Question")).data, { runId: "answer-1", text: "An answer", tokens: { inputTokens: 3, outputTokens: 4 } });
assert.equal(lastInput, "Question");
output = "";
assert.equal((await service.answer([{ role: "user", content: "Another question" }])).data.text, "");
assert.deepEqual(lastInput, [{ role: "user", content: "Another question" }]);
assert.equal(starts, 2, "the borrowed client remains usable between requests");
for (const [status, code] of [["failed", "run_failed"], ["cancelled", "run_cancelled"], ["running", "run_incomplete"], ["new-provider-state", "run_incomplete"]]) {
  state = status;
  output = "Partial text";
  const raw = await client.startRun({ model: "fixture-model", input: "Raw state" });
  assert.equal(raw.ok, true, "opt-in helpers must not alter facade results");
  assert.equal(raw.data.status, status);
  await assert.rejects(service.answer("Requires completion"), (error) => {
    assert.ok(isApiClientError(error));
    assert.equal(error.code, code);
    assert.equal(error.cause.run_id, "answer-1");
    return true;
  });
}
state = "completed";
output = undefined;
await assert.rejects(service.answer("No output"), { code: ApiClientErrorCode.RunOutputMissing });
rejection = new ApiClientError("Private authentication diagnostic", { type: "auth", code: ApiClientErrorCode.AuthRequired });
await assert.rejects(service.answer("Authentication"), (error) => error === rejection);
rejection = new Error("Unclassified failure");
await assert.rejects(service.answer("Unknown exception"), (error) => error === rejection);
rejection = undefined;

const unsupported = createCapabilityClient({
  providerKind: "fixture", fallbackSupports: {},
  runtime: { ...runtime, getRuntimeCapabilities: async () => ({ providerKind: "fixture", supports: {} }) },
});
assert.equal((await createAnswerService(unsupported, "fixture-model").answer("Unavailable")).ok, false);
assert.equal((await streamAnswer(unsupported, { input: "Unavailable" }, () => {}, AbortSignal.timeout(1_000), () => {})).ok, false);
let written = "";
const stream = () => streamAnswer(client, { model: "fixture-model", input: "Stream" }, (delta) => { written += delta; }, AbortSignal.timeout(1_000), () => {});
events = [{ event: "message.delta", runId: "stream-1", delta: "Partial" }, { event: "run.completed", runId: "stream-1", output: "Final answer", usage: { totalTokens: 7 } }];
const answer = await stream();
assert.equal(written, "Partial");
assert.deepEqual(answer.data, { runId: "stream-1", text: "Final answer", tokens: { totalTokens: 7 } });
assert.ok(!("error" in answer.data), "protected diagnostics must not enter successful answers");
events[1].output = "";
assert.equal((await stream()).data.text, "", "an explicit empty terminal snapshot must replace accumulated deltas");
delete events[1].output;
assert.equal((await stream()).data.text, "Partial", "use deltas when the terminal snapshot is absent");
events = [{ event: "run.completed", runId: "stream-1" }];
await assert.rejects(stream(), { code: ApiClientErrorCode.RunOutputMissing });
for (const [event, code] of [["run.failed", "run_failed"], ["run.cancelled", "run_cancelled"], [null, "run_incomplete"]]) {
  events = [{ event: "message.delta", runId: "stream-1", delta: "Partial" }];
  if (event) events.push({ event, runId: "stream-1", error: "private execution details" });
  await assert.rejects(stream(), (error) => {
    assert.ok(isApiClientError(error));
    assert.equal(error.code, code);
    assert.equal(error.cause.runId, "stream-1");
    if (event === "run.failed") assert.equal(error.cause.error, "private execution details");
    return true;
  });
}
await client.dispose();
await unsupported.dispose();
`);
  command(process.execPath, ["run-result-journeys.mjs"], consumer);
}

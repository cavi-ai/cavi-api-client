import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Execute the documented application tests through the installed package. */
export function verifyConsumerTestsExample({ root, installed, consumer, command, docsRoot }) {
  const version = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).version;
  const docs = docsRoot ?? path.join(installed, `docs/api-client/v${version}`);
  const guide = readFileSync(path.join(docs, "guides/testing.md"), "utf8");
  const snippets = [...guide.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)];
  assert.equal(snippets.length, 1, "testing guide must have one complete application test file");
  const example = readFileSync(path.join(docs, "examples/consumer-tests.ts"), "utf8");
  assert.equal(snippets[0][1].trim(), example.trim(), "downloadable tests must match the testing guide");
  compileAndRun({ root, consumer, command, docs, names: ["consumer-tests", "server-handler"] });
}

/** Check resumed batch collection against native HTTP fixtures. */
export function verifyBatchCollectorExample({ root, installed, consumer, command, docsRoot }) {
  const version = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).version;
  const docs = docsRoot ?? path.join(installed, `docs/api-client/v${version}`);
  const guide = readFileSync(path.join(docs, "guides/batching.md"), "utf8");
  const snippet = [...guide.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)][0];
  assert.ok(snippet, "batching guide must include its collector");
  const example = readFileSync(path.join(docs, "examples/batch-collector.ts"), "utf8");
  assert.equal(snippet[1].trim(), example.trim(), "downloadable collector must match the batching guide");
  compileAndRun({ root, consumer, command, docs, names: ["batch-tests", "batch-collector"] });
}

/** Verify text-stream decisions and cleanup through installed entry points. */
export function verifyStreamingExample({ root, installed, consumer, command, docsRoot }) {
  const version = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).version;
  const docs = docsRoot ?? path.join(installed, `docs/api-client/v${version}`);
  const guide = readFileSync(path.join(docs, "guides/streaming.md"), "utf8");
  const snippet = [...guide.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)][0];
  assert.ok(snippet, "streaming guide must include its text helper");
  const example = readFileSync(path.join(docs, "examples/runtime-streaming.ts"), "utf8");
  assert.equal(snippet[1].trim(), example.trim(), "downloadable helper must match the streaming guide");
  compileAndRun({ root, consumer, command, docs, names: ["streaming-tests", "runtime-streaming"] });
}

/** Check persisted file IDs and explicit cleanup through the public file client. */
export function verifyFileExample({ root, installed, consumer, command, docsRoot }) {
  const version = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).version;
  const docs = docsRoot ?? path.join(installed, `docs/api-client/v${version}`);
  const guide = readFileSync(path.join(docs, "guides/files.md"), "utf8");
  const snippet = [...guide.matchAll(/^```ts\s*\n([\s\S]*?)^```/gmu)][0];
  assert.ok(snippet, "files guide must include its lifecycle helpers");
  const example = readFileSync(path.join(docs, "examples/batch-files.ts"), "utf8");
  assert.equal(snippet[1].trim(), example.trim(), "downloadable helpers must match the files guide");
  compileAndRun({ root, consumer, command, docs, names: ["file-tests", "batch-files"] });
}

function compileAndRun({ root, consumer, command, docs, names }) {
  const directory = path.join(consumer, "application-tests");
  mkdirSync(directory, { recursive: true });
  for (const name of names) {
    const source = readFileSync(path.join(docs, `examples/${name}.ts`), "utf8");
    writeFileSync(path.join(directory, `${name}.ts`), source);
  }
  const output = path.join(directory, "built");
  command(path.join(root, "node_modules/.bin/tsc"), [
    "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
    "--strict", "--skipLibCheck", "--types", "node", "--typeRoots", path.join(root, "node_modules/@types"),
    "--outDir", output, ...names.map((name) => path.join(directory, `${name}.ts`)),
  ], consumer);
  command(process.execPath, ["--test", path.join(output, `${names[0]}.js`)], consumer);
}

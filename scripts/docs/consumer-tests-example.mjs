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
  const directory = path.join(consumer, "application-tests");
  mkdirSync(directory, { recursive: true });
  for (const name of ["consumer-tests", "server-handler"]) {
    const source = readFileSync(path.join(docs, `examples/${name}.ts`), "utf8");
    writeFileSync(path.join(directory, `${name}.ts`), source);
  }
  const output = path.join(directory, "built");
  command(path.join(root, "node_modules/.bin/tsc"), [
    "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
    "--strict", "--skipLibCheck", "--types", "node", "--typeRoots", path.join(root, "node_modules/@types"),
    "--outDir", output, path.join(directory, "consumer-tests.ts"), path.join(directory, "server-handler.ts"),
  ], consumer);
  command(process.execPath, ["--test", path.join(output, "consumer-tests.js")], consumer);
}

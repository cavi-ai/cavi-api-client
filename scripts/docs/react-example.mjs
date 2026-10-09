import assert from "node:assert/strict";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export function verifyReactExample({ root, installed, consumer, command, docsRoot }) {
  const version = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).version;
  const docs = docsRoot ?? path.join(installed, `docs/api-client/v${version}`);
  const guide = readFileSync(path.join(docs, "guides/react.md"), "utf8");
  const snippet = [...guide.matchAll(/^```tsx\s*\n([\s\S]*?)^```/gmu)][0];
  assert.ok(snippet, "React guide must include its request example");
  const example = readFileSync(path.join(docs, "examples/react-answer.tsx"), "utf8");
  assert.equal(snippet[1].trim(), example.trim(), "downloadable React example must match its guide");
  for (const dependency of ["@types", "react", "react-dom", "jsdom", "vitest"]) {
    symlinkSync(path.join(root, "node_modules", dependency), path.join(consumer, "node_modules", dependency), "dir");
  }
  const directory = path.join(consumer, "application-tests");
  mkdirSync(directory, { recursive: true });
  const names = ["react-answer.tsx", "react-answer.test.tsx", "server-handler.ts"];
  for (const name of names) {
    writeFileSync(path.join(directory, name), readFileSync(path.join(docs, "examples", name), "utf8"));
  }
  command(path.join(root, "node_modules/.bin/tsc"), [
    "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--jsx", "react-jsx",
    "--strict", "--skipLibCheck", "--types", "node", "--typeRoots", path.join(root, "node_modules/@types"),
    "--noEmit", ...names.map((name) => path.join(directory, name)),
  ], consumer);
  const config = path.join(consumer, "vitest.react.config.mjs");
  writeFileSync(config, `export default ${JSON.stringify({ test: {
    environment: "jsdom", include: ["application-tests/react-answer.test.tsx"], maxWorkers: 1,
  } })};\n`);
  command(process.execPath, [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", config], consumer);
}

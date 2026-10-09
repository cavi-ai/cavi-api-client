import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolveStableTarball } from "./fetch-stable.mjs";
import { DOCUMENTED_TAG } from "./types.mjs";
import { verifyConsumerTestsExample, verifyBatchCollectorExample, verifyStreamingExample, verifyFileExample } from "./consumer-tests-example.mjs";
import { verifyReactExample } from "./react-example.mjs";

// The pinned version and its sha256 live in types.mjs; obtaining + verifying the
// artifact lives in fetch-stable.mjs. Validate declarations and the runnable
// application tests against that exact package.
const tarball = resolveStableTarball();

const workspace = mkdtempSync(path.join(tmpdir(), "cavi-docs-stable-"));
try {
  execFileSync("tar", ["-xzf", path.resolve(tarball), "-C", workspace], { stdio: "inherit" });
  const declarations = path.join(workspace, "package", "dist");
  const config = JSON.parse(readFileSync("tsconfig.docs-stable.json", "utf8"));
  config.compilerOptions.paths = {
    "@cavi-ai/api-client": [path.join(declarations, "index.d.ts")],
    "@cavi-ai/api-client/*": [path.join(declarations, "*")],
  };
  config.compilerOptions.typeRoots = [path.resolve("node_modules/@types")];
  config.include = [
    path.resolve(`docs/api-client/${DOCUMENTED_TAG}/examples/**/*.ts`),
    path.resolve(`docs/api-client/${DOCUMENTED_TAG}/examples/**/*.tsx`),
    path.resolve("docs/examples/contracts/**/*.ts"),
  ];
  // Check the complete adoption examples shown to readers, not just download files.
  // Stage sibling downloads so snippets can import application examples exactly
  // as readers do after saving them together (e.g. ./server-handler.js).
  const snippetDirectory = path.join(workspace, "examples");
  cpSync(path.resolve(`docs/api-client/${DOCUMENTED_TAG}/examples`), snippetDirectory, { recursive: true });
  const markdown = ["README.md"];
  for (const section of ["introduction", "concepts", "guides"]) {
    const directory = `docs/api-client/${DOCUMENTED_TAG}/${section}`;
    markdown.push(...readdirSync(directory).filter((name) => name.endsWith(".md")).map((name) => `${directory}/${name}`));
  }
  for (const [pageIndex, page] of markdown.entries()) {
    const source = readFileSync(page, "utf8");
    for (const [snippetIndex, match] of [...source.matchAll(/^```(ts|tsx)\s*\n([\s\S]*?)^```/gmu)].entries()) {
      const snippet = path.join(snippetDirectory, `page-${pageIndex}-snippet-${snippetIndex}.${match[1]}`);
      writeFileSync(snippet, `${match[2]}\nexport {};\n`);
      config.include.push(snippet);
    }
  }
  const generatedConfig = path.join(workspace, "tsconfig.docs-stable.json");
  writeFileSync(generatedConfig, `${JSON.stringify(config, null, 2)}\n`);
  execFileSync(path.resolve("node_modules/.bin/tsc"), ["--noEmit", "-p", generatedConfig], {
    stdio: "inherit",
  });
  const consumer = path.join(workspace, "consumer");
  const installed = path.join(consumer, "node_modules/@cavi-ai/api-client");
  mkdirSync(path.dirname(installed), { recursive: true });
  symlinkSync(path.join(workspace, "package"), installed, "dir");
  writeFileSync(path.join(consumer, "package.json"), '{"type":"module"}\n');
  const testOptions = {
    root: path.resolve("."), installed, consumer,
    docsRoot: path.resolve(`docs/api-client/${DOCUMENTED_TAG}`),
    command: (executable, args, cwd) => execFileSync(executable, args, { cwd, stdio: "inherit" }),
  };
  verifyConsumerTestsExample(testOptions);
  verifyBatchCollectorExample(testOptions);
  verifyStreamingExample(testOptions);
  verifyFileExample(testOptions);
  verifyReactExample(testOptions);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

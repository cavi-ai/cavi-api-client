import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolveStableTarball } from "./fetch-stable.mjs";
import { DOCUMENTED_TAG } from "./types.mjs";

// The pinned version and its sha256 live in types.mjs; obtaining + verifying the
// artifact lives in fetch-stable.mjs. This script only type-checks against it.
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
  const markdown = ["README.md"];
  for (const section of ["introduction", "concepts", "guides"]) {
    const directory = `docs/api-client/${DOCUMENTED_TAG}/${section}`;
    markdown.push(...readdirSync(directory).filter((name) => name.endsWith(".md")).map((name) => `${directory}/${name}`));
  }
  for (const [pageIndex, page] of markdown.entries()) {
    const source = readFileSync(page, "utf8");
    for (const [snippetIndex, match] of [...source.matchAll(/^```(ts|tsx)\s*\n([\s\S]*?)^```/gmu)].entries()) {
      const snippet = path.join(workspace, `page-${pageIndex}-snippet-${snippetIndex}.${match[1]}`);
      writeFileSync(snippet, `${match[2]}\nexport {};\n`);
      config.include.push(snippet);
    }
  }
  const generatedConfig = path.join(workspace, "tsconfig.docs-stable.json");
  writeFileSync(generatedConfig, `${JSON.stringify(config, null, 2)}\n`);
  execFileSync(path.resolve("node_modules/.bin/tsc"), ["--noEmit", "-p", generatedConfig], {
    stdio: "inherit",
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

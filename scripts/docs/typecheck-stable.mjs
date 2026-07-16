import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const generatedConfig = path.join(workspace, "tsconfig.docs-stable.json");
  writeFileSync(generatedConfig, `${JSON.stringify(config, null, 2)}\n`);
  execFileSync(path.resolve("node_modules/.bin/tsc"), ["--noEmit", "-p", generatedConfig], {
    stdio: "inherit",
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

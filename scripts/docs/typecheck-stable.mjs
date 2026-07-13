import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const expectedDigest = "93b1abc345e42de4e3e4a8744b2dc72d5ed850952ff9176bb179382f79ffc13a";
const tarball = process.env.CAVI_API_CLIENT_STABLE_TARBALL;

if (!tarball) {
  throw new Error(
    "CAVI_API_CLIENT_STABLE_TARBALL is required; set it to the @cavi-ai/api-client@0.11.0 .tgz artifact",
  );
}

const observedDigest = createHash("sha256").update(readFileSync(tarball)).digest("hex");
if (observedDigest !== expectedDigest) {
  throw new Error(`stable artifact digest mismatch: expected ${expectedDigest}; observed ${observedDigest}`);
}

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
  config.include = [path.resolve("docs/**/*.ts"), path.resolve("docs/**/*.tsx")];
  const generatedConfig = path.join(workspace, "tsconfig.docs-stable.json");
  writeFileSync(generatedConfig, `${JSON.stringify(config, null, 2)}\n`);
  execFileSync(path.resolve("node_modules/.bin/tsc"), ["--noEmit", "-p", generatedConfig], {
    stdio: "inherit",
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

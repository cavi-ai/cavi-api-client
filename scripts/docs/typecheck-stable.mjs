import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const expectedDigest = "3379cd47b4890d0e00f5949583f90a83367705878b16141e825f66ef5d8819e5";
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
  config.include = [
    path.resolve("docs/api-client/v0.11.0/examples/**/*.ts"),
    path.resolve("docs/api-client/v0.11.0/examples/**/*.tsx"),
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

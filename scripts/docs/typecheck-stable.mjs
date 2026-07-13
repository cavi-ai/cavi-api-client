import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const expectedDigest = "93b1abc345e42de4e3e4a8744b2dc72d5ed850952ff9176bb179382f79ffc13a";
const tarball = process.env.CAVI_API_CLIENT_STABLE_TARBALL
  ?? "/Volumes/MIRZA/workspace/CAVI/packages/cavi-api-client/cavi-ai-api-client-0.11.0.tgz";
const extractionRoot = "/private/tmp/cavi-docs-stable-0.11.0";
const observedDigest = createHash("sha256").update(readFileSync(tarball)).digest("hex");

if (observedDigest !== expectedDigest) {
  throw new Error(`stable artifact digest mismatch: expected ${expectedDigest}; observed ${observedDigest}`);
}

rmSync(extractionRoot, { recursive: true, force: true });
mkdirSync(extractionRoot, { recursive: true });
execFileSync("tar", ["-xzf", tarball, "-C", extractionRoot], { stdio: "inherit" });
execFileSync("./node_modules/.bin/tsc", ["--noEmit", "-p", "tsconfig.docs-stable.json"], {
  stdio: "inherit",
});

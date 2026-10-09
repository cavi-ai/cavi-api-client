import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../../.github/workflows/publish.yml", import.meta.url), "utf8");
const publishStep = workflow.split("      - name: Publish package\n")[1];
const publishScript = publishStep.match(/        run: \|\n((?:          [^\n]*\n|\n)+)/u)![1]
  .replace(/^          /gmu, "");
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function runPublish({ tag = "v1.0.0", published = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "cavi-publish-workflow-"));
  directories.push(root);
  const checkout = path.join(root, "checkout");
  const bin = path.join(root, "bin");
  const stable = path.join(root, "stable");
  const runnerTemp = path.join(root, "runner");
  for (const directory of [checkout, bin, stable, runnerTemp]) mkdirSync(directory);
  mkdirSync(path.join(checkout, "dist"));
  writeFileSync(path.join(checkout, "package.json"), JSON.stringify({
    name: "@cavi-ai/api-client", version: "1.0.0", files: ["dist"],
  }));
  writeFileSync(path.join(checkout, "dist/index.js"), 'export const revision = "release-checkout";\n');
  mkdirSync(path.join(stable, "package/dist"), { recursive: true });
  writeFileSync(path.join(stable, "package/dist/index.js"), 'export const revision = "old-docs-pin";\n');
  const stableTarball = path.join(root, "stable.tgz");
  execFileSync("tar", ["-czf", stableTarball, "-C", stable, "package"]);
  const receipt = path.join(root, "published-path.txt");
  // Replace only npm's external registry/install/publication boundary. The
  // workflow shell, version checks, pnpm packing, and archive contents are real.
  writeFileSync(path.join(bin, "npm"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "view") process.exit(process.env.FIXTURE_PUBLISHED === "1" ? 0 : 1);
if (args[0] === "install" || args[0] === "--version") process.exit(0);
if (args[0] !== "publish" || !args.includes("--provenance")) process.exit(2);
fs.writeFileSync(process.env.FIXTURE_RECEIPT, args[1]);
`, { mode: 0o755 });
  const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", publishScript], {
    cwd: checkout, encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      RELEASE_TAG: tag,
      RUNNER_TEMP: runnerTemp,
      CAVI_API_CLIENT_STABLE_TARBALL: stableTarball,
      FIXTURE_RECEIPT: receipt,
      FIXTURE_PUBLISHED: published ? "1" : "0",
    },
  });
  return { result, receipt, stableTarball };
}

describe("npm release workflow", () => {
  it("publishes the release checkout's packed code rather than the older docs pin", () => {
    const { result, receipt, stableTarball } = runPublish();
    expect(result.status, result.stderr).toBe(0);
    const artifact = readFileSync(receipt, "utf8");
    expect(artifact).not.toBe(stableTarball);
    expect(execFileSync("tar", ["-xOzf", artifact, "package/dist/index.js"], { encoding: "utf8" }))
      .toBe('export const revision = "release-checkout";\n');
  });

  it("rejects a release tag that differs from the checkout version before publishing", () => {
    const { result, receipt } = runPublish({ tag: "v2.0.0" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("does not match package version");
    expect(() => readFileSync(receipt)).toThrow();
  });

  it("keeps an already-published release idempotent without publishing again", () => {
    const { result, receipt } = runPublish({ published: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("already published");
    expect(() => readFileSync(receipt)).toThrow();
  });
});

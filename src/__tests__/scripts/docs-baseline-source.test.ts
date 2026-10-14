import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const exec = promisify(execFile);
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

async function fixture(source: string) {
  const root = await mkdtemp(path.join(tmpdir(), "cavi-baseline-source-"));
  directories.push(root);
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  pkg.documentation.source = source;
  const manifest = `docs/api-client/source/releases/${pkg.documentation.version}-manifest.json`;
  const pin = JSON.parse(await readFile(manifest, "utf8"));
  await mkdir(path.join(root, "scripts/docs"), { recursive: true });
  await mkdir(path.dirname(path.join(root, manifest)), { recursive: true });
  await mkdir(path.join(root, "bin"));
  await writeFile(path.join(root, "package.json"), JSON.stringify(pkg));
  for (const file of ["scripts/docs/types.mjs", "scripts/docs/fetch-stable.mjs", manifest]) {
    await cp(file, path.join(root, file));
  }
  const { stdout: gitDir } = await exec("git", ["rev-parse", "--absolute-git-dir"]);
  await writeFile(path.join(root, ".git"), `gitdir: ${gitDir.trim()}\n`);
  const marker = path.join(root, "registry-requested");
  await writeFile(path.join(root, "bin/curl"), `#!${process.execPath}
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "requested");
const args = process.argv.slice(2);
writeFileSync(args[args.indexOf("-o") + 1], "different-registry-artifact");
`, { mode: 0o755 });
  return { root, pin, marker, env: { ...process.env, HUSKY: "0", PATH: `${path.join(root, "bin")}${path.delimiter}${process.env.PATH}` } };
}

describe("documentation baseline source", () => {
  it("rebuilds a source snapshot without requesting a same-version registry artifact", async () => {
    const { root, pin, marker, env } = await fixture("git");
    const { stdout } = await exec(process.execPath, ["scripts/docs/fetch-stable.mjs"], { cwd: root, env, maxBuffer: 4 * 1024 * 1024 });
    const artifact = await readFile(stdout.trim());
    expect(createHash("sha256").update(artifact).digest("hex")).toBe(pin.sha256);
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
  }, 120_000);

  it("rejects unknown source kinds before provisioning an artifact", async () => {
    const { root, marker, env } = await fixture("unknown");
    await expect(exec(process.execPath, ["scripts/docs/fetch-stable.mjs"], { cwd: root, env }))
      .rejects.toMatchObject({ stderr: expect.stringContaining("documentation.source") });
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps registry artifact digest mismatches fatal", async () => {
    const { root, marker, env } = await fixture("npm");
    await expect(exec(process.execPath, ["scripts/docs/fetch-stable.mjs"], { cwd: root, env }))
      .rejects.toMatchObject({ stderr: expect.stringContaining("stable artifact digest mismatch") });
    expect(await readFile(marker, "utf8")).toBe("requested");
  });
});

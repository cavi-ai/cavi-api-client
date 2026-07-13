import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import { inspectRelease } from "../../scripts/docs/inspect-release.mjs";

const execFileAsync = promisify(execFile);
const fixture = path.resolve("src/__tests__/fixtures/docs-release/package");
const temporaryDirectories: string[] = [];

async function packFixture(
  mutate?: (packageDirectory: string) => Promise<void>,
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-release-test-"));
  temporaryDirectories.push(directory);
  const packageDirectory = path.join(directory, "package");
  await cp(fixture, packageDirectory, { recursive: true });
  await mutate?.(packageDirectory);
  const tarball = path.join(directory, "release.tgz");
  await execFileAsync("tar", ["-czf", tarball, "package"], { cwd: directory });
  return tarball;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("inspectRelease", () => {
  it("inspects public type exports in a stable release tarball", async () => {
    const manifest = await inspectRelease(await packFixture());

    expect(manifest.package).toBe("@cavi-ai/api-client");
    expect(manifest.version).toBe("0.11.0");
    expect(manifest.exports.map((entry) => entry.subpath)).toEqual([
      ".",
      "./core/runtime",
    ]);
    expect(manifest.exports[0].types).toBe("./dist/index.d.ts");
    expect(manifest.symbols).toContainEqual({
      subpath: ".",
      name: "RuntimeClient",
      kind: "interface",
    });
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects release version drift", async () => {
    const tarball = await packFixture(async (packageDirectory) => {
      const packageJsonPath = path.join(packageDirectory, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
      packageJson.version = "0.11.1";
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    });

    await expect(inspectRelease(tarball)).rejects.toThrow(
      "release mismatch: expected @cavi-ai/api-client@0.11.0, observed @cavi-ai/api-client@0.11.1",
    );
  });

  it("rejects an export whose declaration is absent", async () => {
    const tarball = await packFixture(async (packageDirectory) => {
      await unlink(path.join(packageDirectory, "dist/core/runtime/index.d.ts"));
    });

    await expect(inspectRelease(tarball)).rejects.toThrow(
      /missing declaration.*\.\/dist\/core\/runtime\/index\.d\.ts/u,
    );
  });
});

import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import {
  inspectRelease,
  inspectReleaseFixtureForTest,
} from "../../scripts/docs/inspect-release.mjs";
import {
  DOCUMENTED_PACKAGE,
  DOCUMENTED_VERSION,
} from "../../scripts/docs/types.mjs";
import { UNDOCUMENTED_VERSION } from "./support/documented-release.js";

const execFileAsync = promisify(execFile);
const fixture = path.resolve("src/__tests__/fixtures/docs-release/package");
const temporaryDirectories: string[] = [];
async function inspectFixture(
  tarball: string,
  limits?: { maxFileCount?: number; maxExpandedBytes?: number },
) {
  return inspectReleaseFixtureForTest(tarball, undefined, limits);
}

async function writePackageVersion(packageDirectory: string, version: string): Promise<void> {
  const packageJsonPath = path.join(packageDirectory, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  packageJson.version = version;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

type TarFixtureEntry = {
  name: string;
  type?: string;
  contents?: Buffer;
  linkName?: string;
};

function tarString(header: Buffer, offset: number, length: number, value: string) {
  Buffer.from(value).copy(header, offset, 0, length);
}

function tarOctal(header: Buffer, offset: number, length: number, value: number) {
  tarString(header, offset, length - 1, value.toString(8).padStart(length - 1, "0"));
  header[offset + length - 1] = 0;
}

function tarFixtureEntry({
  name,
  type = "0",
  contents = Buffer.alloc(0),
  linkName = "",
}: TarFixtureEntry): Buffer {
  const header = Buffer.alloc(512);
  tarString(header, 0, 100, name);
  tarOctal(header, 100, 8, type === "5" ? 0o755 : 0o644);
  tarOctal(header, 108, 8, 0);
  tarOctal(header, 116, 8, 0);
  tarOctal(header, 124, 12, contents.length);
  tarOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = type.charCodeAt(0);
  tarString(header, 157, 100, linkName);
  tarString(header, 257, 6, "ustar\0");
  tarString(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  tarString(header, 148, 6, checksum.toString(8).padStart(6, "0"));
  header[154] = 0;
  header[155] = 0x20;
  return Buffer.concat([
    header,
    contents,
    Buffer.alloc((512 - (contents.length % 512)) % 512),
  ]);
}

function minimalPackageEntries(): TarFixtureEntry[] {
  return [
    { name: "package/", type: "5" },
    {
      name: "package/package.json",
      contents: Buffer.from(`${JSON.stringify({
        name: DOCUMENTED_PACKAGE,
        version: DOCUMENTED_VERSION,
      })}\n`),
    },
  ];
}

async function packRawFixture(entries: TarFixtureEntry[]): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-release-test-"));
  temporaryDirectories.push(directory);
  const tarball = path.join(directory, "release.tgz");
  const tar = Buffer.concat([...entries.map(tarFixtureEntry), Buffer.alloc(1024)]);
  await writeFile(tarball, gzipSync(tar));
  return tarball;
}

/**
 * Pack the synthetic release fixture, stamped with the documented version.
 *
 * The fixture's committed package.json cannot import the pins, so the version it
 * carries is re-stamped here instead — the pin stays the single source of truth
 * and the fixture's own literal never has to be bumped. `mutate` runs afterwards,
 * so drift cases can still install a deliberately wrong version.
 */
async function packFixture(
  mutate?: (packageDirectory: string) => Promise<void>,
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-release-test-"));
  temporaryDirectories.push(directory);
  const packageDirectory = path.join(directory, "package");
  await cp(fixture, packageDirectory, { recursive: true });
  await writePackageVersion(packageDirectory, DOCUMENTED_VERSION);
  await mutate?.(packageDirectory);
  const tarball = path.join(directory, "release.tgz");
  await execFileAsync("tar", ["-czf", tarball, "--format=ustar", "package"], {
    cwd: directory,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
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
  it("rejects a wrong digest before attempting tar extraction", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-release-test-"));
    temporaryDirectories.push(directory);
    const invalidArchive = path.join(directory, "not-a-tarball.tgz");
    await writeFile(invalidArchive, "wrong artifact");
    await expect(inspectRelease(invalidArchive)).rejects.toThrow("stable artifact digest mismatch");
  });

  it("verifies the selected release digest before invoking tar", async () => {
    const inspector = await readFile("scripts/docs/inspect-release.mjs", "utf8");
    const productionInspector = inspector.slice(inspector.indexOf("async function inspectReleaseWithRelease"), inspector.indexOf("/** @param {string} tgzPath"));
    const digestGuard = productionInspector.indexOf("sha256 !== release.tarballSha256");

    expect(digestGuard).toBeGreaterThan(-1);
    expect(productionInspector.indexOf('execFileAsync("tar"')).toBeGreaterThan(digestGuard);
    expect(inspectRelease.length).toBe(1);
  });

  it.each([
    "scripts/docs/build.mjs",
    "scripts/docs/check.mjs",
    "scripts/docs/snapshot-release.mjs",
  ])("does not let production CLI %s accept or forward an arbitrary digest", async (script) => {
    const source = await readFile(script, "utf8");

    expect(source).not.toContain("expected-sha256");
    expect(source).not.toContain("expectedSha256");
    expect(source).not.toContain("inspectReleaseFixtureForTest");
  });

  it("rejects digest override arguments at every production CLI boundary", async () => {
    const override = ["--expected-sha256", "0".repeat(64)];
    await expect(execFileAsync(process.execPath, ["scripts/docs/build.mjs", ...override]))
      .rejects.toMatchObject({ stderr: expect.stringContaining("unsupported option --expected-sha256") });
    await expect(execFileAsync(process.execPath, ["scripts/docs/check.mjs", ...override]))
      .rejects.toMatchObject({ stderr: expect.stringContaining("unsupported option --expected-sha256") });
    await expect(execFileAsync(process.execPath, ["scripts/docs/snapshot-release.mjs", "archive.tgz", "manifest.json", "0".repeat(64)]))
      .rejects.toMatchObject({ stderr: expect.stringContaining("usage:") });
  });
  it("inspects public type exports in a stable release tarball", async () => {
    const manifest = await inspectFixture(await packFixture());

    expect(manifest.package).toBe(DOCUMENTED_PACKAGE);
    expect(manifest.version).toBe(DOCUMENTED_VERSION);
    expect(manifest.exports.map((entry) => entry.subpath)).toEqual([
      ".",
      "./core/runtime",
      "./schema.json",
    ]);
    expect(manifest.exports[0].kind).toBe("declaration");
    expect(manifest.exports[0].types).toBe("./dist/index.d.ts");
    expect(manifest.exports[2]).toEqual({
      subpath: "./schema.json",
      kind: "asset",
      target: "./schema.json",
    });
    expect(manifest.symbols).toContainEqual({
      subpath: ".",
      name: "RuntimeClient",
      kind: "interface",
      signature: [
        "export interface RuntimeClient<TInput = string> {",
        "    run(input: TInput): Promise<string>;",
        "}",
      ].join("\n"),
    });
    expect(manifest.symbols).toContainEqual({
      subpath: "./core/runtime",
      name: "RuntimeStatus",
      kind: "type",
      signature: [
        "export type RuntimeStatus<TMetadata extends object = object> = {",
        "    state: \"idle\" | \"running\";",
        "    metadata?: TMetadata;",
        "};",
      ].join("\n"),
    });
    expect(manifest.symbols).toContainEqual({
      subpath: ".",
      name: "createRuntimeClient",
      kind: "function",
      signature: [
        "export declare function createRuntimeClient<TInput>(endpoint: URL, options?: {",
        "    timeoutMs?: number;",
        "}): RuntimeClient<TInput>;",
      ].join("\n"),
    });
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects release version drift", async () => {
    const tarball = await packFixture((packageDirectory) =>
      writePackageVersion(packageDirectory, UNDOCUMENTED_VERSION),
    );

    await expect(inspectFixture(tarball)).rejects.toThrow(
      `release mismatch: expected ${DOCUMENTED_PACKAGE}@${DOCUMENTED_VERSION}, ` +
        `observed ${DOCUMENTED_PACKAGE}@${UNDOCUMENTED_VERSION}`,
    );
  });

  it("rejects an export whose declaration is absent", async () => {
    const tarball = await packFixture(async (packageDirectory) => {
      await unlink(path.join(packageDirectory, "dist/core/runtime/index.d.ts"));
    });

    await expect(inspectFixture(tarball)).rejects.toThrow(
      /missing declaration.*\.\/dist\/core\/runtime\/index\.d\.ts/u,
    );
  });

  it("normalizes a root conditional exports map", async () => {
    const tarball = await packFixture(async (packageDirectory) => {
      const packageJsonPath = path.join(packageDirectory, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
      packageJson.exports = {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      };
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    });

    const manifest = await inspectFixture(tarball);

    expect(manifest.exports).toEqual([
      { subpath: ".", kind: "declaration", types: "./dist/index.d.ts" },
    ]);
  });

  it("resolves nested type conditions for public subpaths only", async () => {
    const tarball = await packFixture(async (packageDirectory) => {
      const packageJsonPath = path.join(packageDirectory, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
      packageJson.exports = {
        ".": {
          import: {
            types: "./dist/index.d.ts",
            default: "./dist/index.js",
          },
        },
        "./core/runtime": {
          node: {
            import: {
              types: "./dist/core/runtime/index.d.ts",
            },
          },
        },
        import: {
          types: "./dist/private.d.ts",
        },
      };
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    });

    const manifest = await inspectFixture(tarball);

    expect(manifest.exports).toEqual([
      { subpath: ".", kind: "declaration", types: "./dist/index.d.ts" },
      {
        subpath: "./core/runtime",
        kind: "declaration",
        types: "./dist/core/runtime/index.d.ts",
      },
    ]);
  });

  it("rejects a declaration symlink during archive preflight", async () => {
    const tarball = await packFixture(async (packageDirectory) => {
      const declarationPath = path.join(packageDirectory, "dist/index.d.ts");
      const externalDeclaration = path.join(
        path.dirname(packageDirectory),
        "external-index.d.ts",
      );
      await writeFile(externalDeclaration, "export interface Escaped {}\n");
      await unlink(declarationPath);
      await symlink(externalDeclaration, declarationPath);
    });

    await expect(inspectFixture(tarball)).rejects.toThrow(/regular file or directory/u);
  });

  it.each([
    ["symbolic link", "2", "../../outside"],
    ["hard link", "1", "package/package.json"],
    ["special member", "6", ""],
  ] as const)("rejects a %s archive member before extraction", async (_label, type, linkName) => {
    const tarball = await packRawFixture([
      ...minimalPackageEntries(),
      { name: "package/hostile", type, linkName },
    ]);

    await expect(inspectFixture(tarball)).rejects.toThrow(/regular file or directory/u);
  });

  it("rejects a symlink pivot before extracting its descendant", async () => {
    const tarball = await packRawFixture([
      ...minimalPackageEntries(),
      { name: "package/pivot", type: "2", linkName: "../outside" },
      { name: "package/pivot/escaped.txt", contents: Buffer.from("escaped\n") },
    ]);

    await expect(inspectFixture(tarball)).rejects.toThrow(/regular file or directory/u);
  });

  it("rejects duplicate normalized archive members", async () => {
    const entries = minimalPackageEntries();
    const tarball = await packRawFixture([...entries, entries[1]!]);

    await expect(inspectFixture(tarball)).rejects.toThrow(/duplicate archive entry/u);
  });

  it("rejects archive member names that are not normalized", async () => {
    const tarball = await packRawFixture([
      ...minimalPackageEntries(),
      { name: "package//nested.txt", contents: Buffer.from("unsafe\n") },
    ]);

    await expect(inspectFixture(tarball)).rejects.toThrow(/normalized/u);
  });

  it("enforces the archive file-count limit before extraction", async () => {
    const tarball = await packRawFixture([
      ...minimalPackageEntries(),
      { name: "package/one.txt", contents: Buffer.from("1") },
      { name: "package/two.txt", contents: Buffer.from("2") },
    ]);

    await expect(inspectFixture(tarball, { maxFileCount: 2 })).rejects.toThrow(/file count limit/u);
  });

  it("enforces the expanded archive size limit before extraction", async () => {
    const tarball = await packRawFixture(minimalPackageEntries());

    await expect(inspectFixture(tarball, { maxExpandedBytes: 16 })).rejects.toThrow(/expanded size limit/u);
  });
});

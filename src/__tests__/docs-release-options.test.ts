import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import { inspectReleaseFixtureForTest } from "../../scripts/release/inspect-release.mjs";
import { buildDocumentationInTemporaryRoot } from "../../scripts/docs/build.mjs";
import { renderDocumentation } from "../../scripts/docs/render.mjs";
import {
  DOCUMENTED_OUTPUT_DIRECTORY,
  DOCUMENTED_VERSION,
  resolveDocumentationRelease,
} from "../../scripts/docs/types.mjs";

const execFileAsync = promisify(execFile);
const fixture = path.resolve("src/__tests__/fixtures/docs-release/package");
const temporaryDirectories: string[] = [];
const release015 = {
  packageName: "@cavi-ai/api-client",
  version: "0.15.0",
  tag: "v0.15.0",
  tarball: "artifacts/cavi-api-client-0.15.0.tgz",
  npmIntegrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}`,
  tarballSha256: "a".repeat(64),
  repository: "cavi-ai/cavi-api-client",
  commit: "b".repeat(40),
};

async function packFixture(version: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-release-options-"));
  temporaryDirectories.push(directory);
  const packageDirectory = path.join(directory, "package");
  await cp(fixture, packageDirectory, { recursive: true });
  const packageJsonPath = path.join(packageDirectory, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  packageJson.version = version;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  const tarball = path.join(directory, "release.tgz");
  await execFileAsync("tar", ["-czf", tarball, "--format=ustar", "package"], {
    cwd: directory,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  return tarball;
}

async function explicitFixtureRelease(version = "0.15.0") {
  const tarball = await packFixture(version);
  const archive = await readFile(tarball);
  return resolveDocumentationRelease({
    ...release015,
    version,
    tag: `v${version}`,
    tarball,
    tarballSha256: createHash("sha256").update(archive).digest("hex"),
    npmIntegrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
  });
}

async function createCuratedContractFixture(root: string): Promise<void> {
  await mkdir(path.join(root, "docs/api-client/source/contracts"), { recursive: true });
  await writeFile(path.join(root, "docs/api-client/source/navigation.json"), "{}\n");
  await writeFile(path.join(root, "docs/api-client/source/contracts/runtime.json"), `${JSON.stringify({
    id: "runtime",
    title: "Runtime",
    version: "{{documentedVersion}}",
    stability: "stable",
    sourceOfTruth: "upstream-compatible-mirror",
    symbols: [{ subpath: ".", name: "RuntimeClient" }],
    capability: "supported",
    summary: "Runtime client contract.",
    purpose: "Starts runtime work.",
    lifecycle: "Created for the client.",
    fieldConstraints: [{ field: "input", constraint: "Required." }],
    behavior: { errors: "Returns errors.", retry: "Caller-controlled.", cancellation: "Abort-supported.", streaming: "Optional." },
    dependencies: { capabilities: ["runtime"], transports: ["HTTP"] },
    examples: { valid: { value: { input: "hello" }, expected: "Accepted." }, invalid: { value: {}, expectedFailure: "Input is required." } },
    compatibilityNotes: "The source record is curated against its stable baseline.",
    evidence: [
      { type: "declaration", path: "docs/api-client/source/releases/{{documentedVersion}}-manifest.json" },
      { type: "fixture", path: "fixtures/runtime.ts" },
      { type: "conformance-test", path: "src/runtime.test.ts" },
    ],
  }, null, 2)}\n`);
  await mkdir(path.join(root, "docs/api-client/source/releases"), { recursive: true });
  await writeFile(path.join(root, "docs/api-client/source/releases/0.15.0-manifest.json"), "{}\n");
  await mkdir(path.join(root, "fixtures"), { recursive: true });
  await writeFile(path.join(root, "fixtures/runtime.ts"), "export const RuntimeClient = true;\n");
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/runtime.test.ts"), "export {};\n");
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("documentation release options", () => {
  it("derives an explicit release's output and source manifest paths without changing stable defaults", () => {
    const release = resolveDocumentationRelease(release015);
    const stable = resolveDocumentationRelease();

    expect(release).toMatchObject({
      ...release015,
      outputDirectory: "docs/api-client/v0.15.0",
      sourceManifestPath: "docs/api-client/source/releases/0.15.0-manifest.json",
    });
    expect(stable.version).toBe(DOCUMENTED_VERSION);
    expect(stable.outputDirectory).toBe(DOCUMENTED_OUTPUT_DIRECTORY);
  });

  it("uses the explicit release identity when inspecting an exact tarball", async () => {
    const tarball = await packFixture("0.15.0");
    const archive = await readFile(tarball);
    const release = resolveDocumentationRelease({
      ...release015,
      tarball,
      tarballSha256: createHash("sha256").update(archive).digest("hex"),
      npmIntegrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
    });

    await expect(inspectReleaseFixtureForTest(tarball, release)).resolves.toMatchObject({
      package: "@cavi-ai/api-client",
      version: "0.15.0",
      tag: "v0.15.0",
      commit: "b".repeat(40),
      sha256: release.tarballSha256,
    });
  });

  it("rejects a descriptor whose package/version does not match the archive", async () => {
    const tarball = await packFixture("0.14.0");
    const archive = await readFile(tarball);
    const release = resolveDocumentationRelease({
      ...release015,
      tarball,
      tarballSha256: createHash("sha256").update(archive).digest("hex"),
      npmIntegrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
    });

    await expect(inspectReleaseFixtureForTest(tarball, release)).rejects.toThrow(
      "release mismatch: expected @cavi-ai/api-client@0.15.0, observed @cavi-ai/api-client@0.14.0",
    );
  });

  it.each([
    ["npm integrity", { ...release015, npmIntegrity: "sha512-not-base64!" }],
    ["tarball digest", { ...release015, tarballSha256: "not-a-sha256" }],
  ])("rejects malformed %s", (_label, options) => {
    expect(() => resolveDocumentationRelease(options)).toThrow(/invalid (npm integrity|tarball sha256)/u);
  });

  it.each([
    "version",
    "tag",
    "repository",
    "commit",
    "npmIntegrity",
    "tarballSha256",
  ] as const)("requires explicit release option %s instead of inheriting a stable pin", (field) => {
    const options: Partial<typeof release015> = { ...release015 };
    delete options[field];

    expect(() => resolveDocumentationRelease(options)).toThrow(`missing required release option ${field}`);
  });

  it("accepts the check command's --out alias for isolated generated output", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "cavi-docs-release-options-"));
    temporaryDirectories.push(temporaryRoot);

    await expect(buildDocumentationInTemporaryRoot([
      "--tarball", path.join(temporaryRoot, "missing.tgz"),
      "--out", "generated",
    ], temporaryRoot)).rejects.not.toThrow(/unsafe temporary documentation output/u);
  });

  it("builds an explicit release against curated stable-baseline contracts", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "cavi-docs-release-options-"));
    temporaryDirectories.push(workspace);
    await createCuratedContractFixture(workspace);
    const release = await explicitFixtureRelease();

    await buildDocumentationInTemporaryRoot([
      "--tarball", release.tarball,
      "--out", "generated",
      "--root", workspace,
      "--version", release.version,
      "--tag", release.tag,
      "--repository", release.repository,
      "--commit", release.commit,
      "--npm-integrity", release.npmIntegrity,
      "--tarball-sha256", release.tarballSha256,
    ], workspace);

    await expect(readFile(path.join(workspace, "generated/contracts/runtime.md"), "utf8"))
      .resolves.toContain("Version: 0.15.0");
  });

  it("renders contract package headers from the selected release", () => {
    const release = resolveDocumentationRelease({
      ...release015,
      packageName: "@example/api-client",
    });
    const output = renderDocumentation({
      manifest: {
        package: release.packageName,
        version: release.version,
        tag: release.tag,
        commit: release.commit,
        sha256: release.tarballSha256,
        exports: [],
        symbols: [],
      },
      contracts: [{
        id: "runtime",
        title: "Runtime",
        version: release.version,
        stability: "stable",
        sourceOfTruth: "upstream-compatible-mirror",
        symbols: [],
        capability: "supported",
        summary: "Runtime client contract.",
        purpose: "Starts runtime work.",
        lifecycle: "Created for the client.",
        fieldConstraints: [{ field: "input", constraint: "Required." }],
        behavior: { errors: "Returns errors.", retry: "Caller-controlled.", cancellation: "Abort-supported.", streaming: "Optional." },
        dependencies: { capabilities: ["runtime"], transports: ["HTTP"] },
        examples: { valid: { value: {}, expected: "Accepted." }, invalid: { value: {}, expectedFailure: "Rejected." } },
        compatibilityNotes: "Upstream compatible.",
        evidence: [],
      }],
      navigation: {},
      curatedRoot: "unused",
      sourceDateEpoch: 1_700_000_000,
      release,
    });

    expect(output.get("contracts/runtime.md")).toContain("Package: @example/api-client");
  });
});

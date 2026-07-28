import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import { buildDocumentationReleaseArtifact } from "../../scripts/docs/release-artifact.mjs";

const execFileAsync = promisify(execFile);
const fixture = path.resolve("src/__tests__/fixtures/docs-release/package");
const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeCuratedContracts(root: string): Promise<void> {
  await mkdir(path.join(root, "docs/api-client/source/contracts"), { recursive: true });
  await writeFile(path.join(root, "docs/api-client/source/navigation.json"), "{}\n");
  await writeFile(path.join(root, "docs/api-client/source/contracts/runtime.json"), `${JSON.stringify({
    id: "runtime",
    title: "Runtime",
    version: "0.14.0",
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
      { type: "declaration", path: "docs/api-client/source/releases/0.14.0-manifest.json" },
      { type: "fixture", path: "fixtures/runtime.ts" },
      { type: "conformance-test", path: "src/runtime.test.ts" },
    ],
  }, null, 2)}\n`);
  await mkdir(path.join(root, "docs/api-client/source/releases"), { recursive: true });
  await writeFile(path.join(root, "docs/api-client/source/releases/0.14.0-manifest.json"), "{}\n");
  await mkdir(path.join(root, "fixtures"), { recursive: true });
  await writeFile(path.join(root, "fixtures/runtime.ts"), "export const RuntimeClient = true;\n");
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/runtime.test.ts"), "export {};\n");
}

async function packFixture(): Promise<{ tarball: string; integrity: string; sha256: string }> {
  const directory = await makeTemporaryDirectory("cavi-docs-release-artifact-");
  const packageDirectory = path.join(directory, "package");
  await cp(fixture, packageDirectory, { recursive: true });
  const packageJsonPath = path.join(packageDirectory, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  packageJson.version = "0.15.0";
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  const tarball = path.join(directory, "release.tgz");
  await execFileAsync("tar", ["-czf", tarball, "package"], { cwd: directory });
  const archive = await readFile(tarball);
  return {
    tarball,
    integrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
    sha256: createHash("sha256").update(archive).digest("hex"),
  };
}

async function artifactInput(outputDirectory: string) {
  const root = await makeTemporaryDirectory("cavi-docs-release-artifact-root-");
  await writeCuratedContracts(root);
  const tarball = await packFixture();
  return {
    root,
    tarball: tarball.tarball,
    outputDirectory,
    sourceDateEpoch: 1_700_000_000,
    release: {
      packageName: "@cavi-ai/api-client",
      version: "0.15.0",
      tag: "v0.15.0",
      npmIntegrity: tarball.integrity,
      tarballSha256: tarball.sha256,
      repository: "cavi-ai/cavi-api-client",
      commit: "b".repeat(40),
    },
  };
}

async function preRenderedDocumentationDirectory(): Promise<string> {
  const directory = await makeTemporaryDirectory("cavi-docs-release-artifact-docs-");
  await writeFile(path.join(directory, "index.md"), "# Generated API docs\n");
  return directory;
}

async function listArchive(tarball: string): Promise<string[]> {
  const { stdout } = await execFileAsync("tar", ["-tzf", tarball]);
  return stdout.trim().split("\n").filter(Boolean).map((entry) => entry.replace(/\/$/u, ""));
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("buildDocumentationReleaseArtifact", () => {
  it("documents the required release inputs through the package command", async () => {
    const { stdout } = await execFileAsync("pnpm", ["run", "docs:release-artifact", "--", "--help"]);

    expect(stdout).toContain("--tarball <release.tgz>");
    expect(stdout).toContain("--output <directory>");
    expect(stdout).toContain("--source-date-epoch <seconds>");
    expect(stdout).toContain("SOURCE_DATE_EPOCH");
    expect(stdout).not.toContain("CAVI_DOCS_PACKAGE_TGZ=");
  });

  it("builds a deterministic docs-only archive with immutable release provenance", async () => {
    const firstOutput = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const secondOutput = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const input = await artifactInput(firstOutput);

    const first = await buildDocumentationReleaseArtifact(input);
    const second = await buildDocumentationReleaseArtifact({ ...input, outputDirectory: secondOutput });

    expect(first.artifactPath).toBe(path.join(firstOutput, "cavi-api-client-docs-v0.15.0.tar.gz"));
    expect(first.sha256Path).toBe(`${first.artifactPath}.sha256`);
    await expect(readFile(first.sha256Path, "utf8")).resolves.toBe(`${first.sha256}\n`);
    await expect(readFile(first.artifactPath)).resolves.toEqual(await readFile(second.artifactPath));

    const entries = await listArchive(first.artifactPath);
    expect(entries).toContain("cavi-release.json");
    expect(entries.some((entry) => entry.startsWith("docs/api-client/v0.15.0/"))).toBe(true);
    expect(entries.every((entry) =>
      entry === "cavi-release.json" || entry.startsWith("docs/api-client/v0.15.0/"),
    )).toBe(true);
    expect(entries.some((entry) => /^(?:package|src|dist)(?:\/|$)/u.test(entry))).toBe(false);
    expect(entries.some((entry) => entry.includes("v0.14.0"))).toBe(false);

    const extraction = await makeTemporaryDirectory("cavi-docs-release-artifact-extract-");
    await execFileAsync("tar", ["-xzf", first.artifactPath, "-C", extraction]);
    const manifest = JSON.parse(await readFile(path.join(extraction, "cavi-release.json"), "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      package: { name: "@cavi-ai/api-client", version: "0.15.0" },
      npm: {
        registry: "https://registry.npmjs.org/",
        integrity: input.release.npmIntegrity,
        tarballSha256: input.release.tarballSha256,
      },
      source: {
        repository: "cavi-ai/cavi-api-client",
        tag: "v0.15.0",
        commit: "b".repeat(40),
      },
      documentation: { contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
      generatedAt: "2023-11-14T22:13:20.000Z",
    });
  });

  it("rejects generated documentation with a symlink before archiving it", async () => {
    const output = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const input = await artifactInput(output);
    const documentationDirectory = await makeTemporaryDirectory("cavi-docs-release-artifact-docs-");
    await mkdir(path.join(documentationDirectory, "nested"));
    await writeFile(path.join(documentationDirectory, "nested/readme.md"), "safe\n");
    await symlink("nested/readme.md", path.join(documentationDirectory, "linked.md"));

    await expect(buildDocumentationReleaseArtifact({ ...input, documentationDirectory })).rejects
      .toThrow(/symlink/u);
  });

  it.each(["package", "src", "dist"])("rejects a prohibited %s directory nested in generated documentation", async (prohibitedDirectory) => {
    const output = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const input = await artifactInput(output);
    const documentationDirectory = await preRenderedDocumentationDirectory();
    await mkdir(path.join(documentationDirectory, "nested", prohibitedDirectory), { recursive: true });
    await writeFile(path.join(documentationDirectory, "nested", prohibitedDirectory, "leaked.md"), "must not ship\n");

    await expect(buildDocumentationReleaseArtifact({ ...input, documentationDirectory })).rejects
      .toThrow(new RegExp(`prohibited.*${prohibitedDirectory}`, "u"));
  });

  it("rejects a SOURCE_DATE_EPOCH that cannot be represented by gzip", async () => {
    const output = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const input = await artifactInput(output);
    const documentationDirectory = await preRenderedDocumentationDirectory();

    await expect(buildDocumentationReleaseArtifact({
      ...input,
      documentationDirectory,
      sourceDateEpoch: 4_294_967_296,
    })).rejects.toThrow(/SOURCE_DATE_EPOCH/u);
  });

  it("rejects a package identity that cannot produce a safe artifact filename", async () => {
    const output = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const input = await artifactInput(output);
    const documentationDirectory = await preRenderedDocumentationDirectory();

    await expect(buildDocumentationReleaseArtifact({
      ...input,
      documentationDirectory,
      release: { ...input.release, packageName: "@cavi-ai/api/client" },
    })).rejects.toThrow(/package name/u);
  });
});

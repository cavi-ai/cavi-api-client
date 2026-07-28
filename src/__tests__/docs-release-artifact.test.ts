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

import { createReleaseEnvelope } from "../../scripts/docs/create-release-envelope.mjs";
import { buildDocumentationReleaseArtifact } from "../../scripts/docs/release-artifact.mjs";
import * as releaseArtifactModule from "../../scripts/docs/release-artifact.mjs";

const execFileAsync = promisify(execFile);
const fixture = path.resolve("src/__tests__/fixtures/docs-release/package");
const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function immutableWriter(): (target: string, contents: Buffer) => Promise<void> {
  const writer = (releaseArtifactModule as unknown as {
    writeIfIdenticalOrAbsent?: (target: string, contents: Buffer) => Promise<void>;
  }).writeIfIdenticalOrAbsent;
  expect(writer).toBeTypeOf("function");
  return writer!;
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
  await execFileAsync("tar", ["-czf", tarball, "--format=ustar", "package"], {
    cwd: directory,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
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

  it("preserves a caller-owned output directory during a CLI dry run", async () => {
    const output = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const sentinel = path.join(output, "caller-owned.txt");
    await writeFile(sentinel, "keep me\n");
    const input = await artifactInput(output);

    await expect(execFileAsync(process.execPath, [
      "scripts/docs/release-artifact.mjs",
      "--tarball", input.tarball,
      "--output", output,
      "--source-date-epoch", String(input.sourceDateEpoch),
      "--version", input.release.version,
      "--tag", input.release.tag,
      "--repository", input.release.repository,
      "--commit", input.release.commit,
      "--npm-integrity", input.release.npmIntegrity,
      "--tarball-sha256", input.release.tarballSha256,
      "--root", input.root,
      "--dry-run",
    ])).rejects.toMatchObject({
      stderr: expect.stringContaining("--dry-run cannot be combined with --output"),
    });

    await expect(readFile(sentinel, "utf8")).resolves.toBe("keep me\n");
  });

  it("rejects a CLI dry run that omits explicit release identity", async () => {
    const output = await makeTemporaryDirectory("cavi-docs-release-artifact-output-");
    const input = await artifactInput(output);

    await expect(execFileAsync(process.execPath, [
      "scripts/docs/release-artifact.mjs",
      "--tarball", input.tarball,
      "--source-date-epoch", String(input.sourceDateEpoch),
      "--tag", input.release.tag,
      "--repository", input.release.repository,
      "--commit", input.release.commit,
      "--npm-integrity", input.release.npmIntegrity,
      "--tarball-sha256", input.release.tarballSha256,
      "--root", input.root,
      "--dry-run",
    ])).rejects.toMatchObject({
      stderr: expect.stringContaining("missing required release option version"),
    });
  });

  it("accepts an identical immutable local write", async () => {
    const directory = await makeTemporaryDirectory("cavi-docs-immutable-");
    const target = path.join(directory, "artifact.bin");
    const writeImmutable = immutableWriter();
    await writeImmutable(target, Buffer.from("same\n"));
    await writeImmutable(target, Buffer.from("same\n"));
    await expect(readFile(target, "utf8")).resolves.toBe("same\n");
  });

  it("rejects a conflicting immutable local write without replacing bytes", async () => {
    const directory = await makeTemporaryDirectory("cavi-docs-immutable-");
    const target = path.join(directory, "artifact.bin");
    const writeImmutable = immutableWriter();
    await writeImmutable(target, Buffer.from("first\n"));
    await expect(writeImmutable(target, Buffer.from("second\n")))
      .rejects.toThrow(/refusing to overwrite non-identical release artifact/u);
    await expect(readFile(target, "utf8")).resolves.toBe("first\n");
  });

  it("accepts concurrent identical immutable local writes", async () => {
    const directory = await makeTemporaryDirectory("cavi-docs-immutable-");
    const target = path.join(directory, "artifact.bin");
    const writeImmutable = immutableWriter();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => writeImmutable(target, Buffer.from("same\n"))),
    );
    expect(results.every(({ status }) => status === "fulfilled")).toBe(true);
    await expect(readFile(target, "utf8")).resolves.toBe("same\n");
  });

  it("allows only one conflicting concurrent immutable local write", async () => {
    const directory = await makeTemporaryDirectory("cavi-docs-immutable-");
    const target = path.join(directory, "artifact.bin");
    const writeImmutable = immutableWriter();
    const contents = Array.from({ length: 8 }, (_, index) => Buffer.from(`value-${index}\n`));
    const results = await Promise.allSettled(
      contents.map((bytes) => writeImmutable(target, bytes)),
    );
    const winners = results.flatMap((result, index) =>
      result.status === "fulfilled" ? [index] : []
    );
    expect(winners).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(7);
    await expect(readFile(target)).resolves.toEqual(contents[winners[0]!]!);
  });

  it("formats a validated secret-free dry-run archive and provenance report before the envelope", () => {
    const format = (releaseArtifactModule as unknown as {
      formatDocumentationReleaseDryRunReport: (input: Record<string, unknown>) => string;
    }).formatDocumentationReleaseDryRunReport;
    expect(format).toBeTypeOf("function");
    const artifactSha256 = "d".repeat(64);
    const envelope = createReleaseEnvelope({
      version: "0.15.0",
      tag: "v0.15.0",
      repository: "cavi-ai/cavi-api-client",
      commit: "b".repeat(40),
      artifactSha256,
    });
    const report = format({
      artifactName: "cavi-api-client-docs-v0.15.0.tar.gz",
      artifactSha256,
      members: ["docs/api-client/v0.15.0/index.md", "cavi-release.json"],
      manifest: {
        schemaVersion: 1,
        package: { name: "@cavi-ai/api-client", version: "0.15.0" },
        npm: {
          registry: "https://registry.npmjs.org/",
          integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}`,
          tarballSha256: "a".repeat(64),
        },
        source: {
          repository: "cavi-ai/cavi-api-client",
          tag: "v0.15.0",
          commit: "b".repeat(40),
        },
        documentation: { contentSha256: "c".repeat(64) },
        internalToken: "must-not-leak",
        localPath: "/runner/temp/private",
      },
      envelope,
    });

    expect(report).toContain(
      "validated archive members (2):\ncavi-release.json\ndocs/api-client/v0.15.0/index.md",
    );
    expect(report).toContain("selected cavi-release provenance and digests:");
    expect(report).toContain('"integrity"');
    expect(report).toContain('"tarballSha256"');
    expect(report).toContain('"contentSha256"');
    expect(report).toContain('"sha256"');
    expect(report.indexOf("selected cavi-release provenance and digests:"))
      .toBeLessThan(report.indexOf("release envelope:"));
    expect(report).not.toContain("must-not-leak");
    expect(report).not.toContain("/runner/temp/private");
    expect(report).not.toContain("internalToken");
  });

  it("rejects an unsafe member before formatting a dry-run report", () => {
    const format = (releaseArtifactModule as unknown as {
      formatDocumentationReleaseDryRunReport: (input: Record<string, unknown>) => string;
    }).formatDocumentationReleaseDryRunReport;
    expect(format).toBeTypeOf("function");

    expect(() => format({
      artifactName: "cavi-api-client-docs-v0.15.0.tar.gz",
      artifactSha256: "d".repeat(64),
      members: ["cavi-release.json", "../secret"],
      manifest: {
        schemaVersion: 1,
        package: { name: "@cavi-ai/api-client", version: "0.15.0" },
        npm: {
          registry: "https://registry.npmjs.org/",
          integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}`,
          tarballSha256: "a".repeat(64),
        },
        source: {
          repository: "cavi-ai/cavi-api-client",
          tag: "v0.15.0",
          commit: "b".repeat(40),
        },
        documentation: { contentSha256: "c".repeat(64) },
      },
      envelope: createReleaseEnvelope({
        version: "0.15.0",
        tag: "v0.15.0",
        repository: "cavi-ai/cavi-api-client",
        commit: "b".repeat(40),
        artifactSha256: "d".repeat(64),
      }),
    })).toThrow(/archive member.*normalized/u);
  });
});

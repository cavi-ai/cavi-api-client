import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildConsumerSnapshot,
  isolatedGitEnvironment,
  verifyConsumerSnapshotBundle,
} from "../../scripts/runtime-control/build-consumer-snapshot.mjs";
import {
  prepareConsumerInput,
  summarizeConsumerSnapshotProvenance,
} from "../../scripts/runtime-control/verify-consumers.mjs";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "runtime-control-snapshot-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function git(directory: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    env: isolatedGitEnvironment(),
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function sourceFixture() {
  const source = temporaryDirectory();
  git(source, ["init", "-q"]);
  git(source, ["config", "user.name", "Snapshot Test"]);
  git(source, ["config", "user.email", "snapshot-test@localhost"]);
  git(source, ["remote", "add", "origin", "https://github.com/example/fixture.git"]);
  writeFileSync(path.join(source, "package.json"), "{\"name\":\"fixture\"}\n");
  writeFileSync(path.join(source, "tracked.txt"), "base\n");
  git(source, ["add", "."]);
  git(source, ["commit", "-q", "-m", "base"]);
  writeFileSync(path.join(source, "tracked.txt"), "changed\n");
  writeFileSync(path.join(source, "runtime.ts"), "export const runtime = true;\n");
  mkdirSync(path.join(source, ".superpowers"));
  writeFileSync(path.join(source, ".superpowers/private.md"), "private\n");
  mkdirSync(path.join(source, "test-results"));
  writeFileSync(path.join(source, "test-results/result.json"), "{}\n");
  writeFileSync(path.join(source, "registry"), "private registry\n");
  return source;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("runtime-control consumer snapshot producer", () => {
  it("creates deterministic reconstructable bundles with intended untracked files and private exclusions", () => {
    const source = sourceFixture();
    const packageBareBefore = git(process.cwd(), ["config", "--get", "core.bare"]);
    const packageWorktreeBefore = git(process.cwd(), ["rev-parse", "--is-inside-work-tree"]);
    const before = git(source, ["status", "--porcelain=v1", "-z"]);
    const first = buildConsumerSnapshot({ label: "cavi-control", outputDirectory: temporaryDirectory(), sourceRoot: source });
    const second = buildConsumerSnapshot({ label: "cavi-control", outputDirectory: temporaryDirectory(), sourceRoot: source });

    expect(second.bundle.sha256).toBe(first.bundle.sha256);
    expect(second.snapshotCommit).toBe(first.snapshotCommit);
    expect(second.snapshotTree).toBe(first.snapshotTree);
    expect(first.originalSourceStatus).toMatchObject({ equal: true });
    expect(git(source, ["status", "--porcelain=v1", "-z"])).toBe(before);
    expect(first.includedPaths).toContain("runtime.ts");
    expect(first.includedPaths).not.toContain("registry");
    expect(first.includedPaths.some((entry) => entry.startsWith(".superpowers/"))).toBe(false);
    expect(first.includedPaths.some((entry) => entry.startsWith("test-results/"))).toBe(false);
    expect(first.untrackedIncludedInventory.count).toBe(1);
    expect(first.originalSourceStatus.beforeSha256).not.toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(first.trackedDiffSha256).not.toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(git(process.cwd(), ["config", "--get", "core.bare"])).toBe(packageBareBefore);
    expect(git(process.cwd(), ["rev-parse", "--is-inside-work-tree"])).toBe(packageWorktreeBefore);
    expect(verifyConsumerSnapshotBundle(first.metadataPath)).toMatchObject({
      commit: first.snapshotCommit,
      tree: first.snapshotTree,
    });
  });

  it("rejects a prior synthetic clone when a named repository and base are required", () => {
    const source = sourceFixture();
    git(source, ["remote", "set-url", "origin", "."]);

    expect(() => buildConsumerSnapshot({
      expectedBaseRevision: git(source, ["rev-parse", "HEAD"]),
      expectedOrigin: "https://github.com/example/fixture.git",
      label: "cc-mobile",
      outputDirectory: temporaryDirectory(),
      sourceRoot: source,
    })).toThrow(/snapshot source origin mismatch/u);
  });

  it("fails closed when included source contains an absolute workstation path", () => {
    const source = sourceFixture();
    const output = temporaryDirectory();
    writeFileSync(path.join(source, "private-path.txt"), "/Volumes/MIRZA/private/source\n");

    expect(() => buildConsumerSnapshot({
      label: "cc-mobile",
      outputDirectory: output,
      sourceRoot: source,
    })).toThrow(/new private workstation path/u);
    expect(existsSync(path.join(output, "cc-mobile.bundle"))).toBe(false);
    expect(existsSync(path.join(output, "cc-mobile.json"))).toBe(false);
  });

  it("allows pre-existing workstation paths and the explicitly approved final RC path", () => {
    const source = sourceFixture();
    writeFileSync(path.join(source, "legacy.md"), "existing /Volumes/MIRZA/legacy/path\n");
    git(source, ["add", "legacy.md"]);
    git(source, ["commit", "-q", "-m", "legacy path"]);
    writeFileSync(path.join(source, "legacy.md"), "existing /Volumes/MIRZA/legacy/path\nchanged\n");
    const approved = "/Volumes/MIRZA/workspace/CAVI/packages/cavi-api-client/.artifacts/final.tgz";
    writeFileSync(path.join(source, "package.json"), JSON.stringify({ dependencies: { client: `file:${approved}` } }));

    const result = buildConsumerSnapshot({
      allowedAbsolutePaths: [approved],
      label: "cc-mobile",
      outputDirectory: temporaryDirectory(),
      sourceRoot: source,
    });

    expect(result.allowedAbsolutePathSha256).toEqual([
      createHash("sha256").update(approved).digest("hex"),
    ]);
    expect(JSON.stringify(result.allowedAbsolutePathSha256)).not.toContain("/Volumes/");
  });

  it("rejects a wrong bundle digest and a bundle whose recorded commit is wrong", () => {
    const result = buildConsumerSnapshot({
      label: "cc-mobile",
      outputDirectory: temporaryDirectory(),
      sourceRoot: sourceFixture(),
    });
    const metadata = JSON.parse(readFileSync(result.metadataPath, "utf8"));
    metadata.bundle.sha256 = "0".repeat(64);
    const wrongDigest = path.join(path.dirname(result.metadataPath), "wrong-digest.json");
    writeFileSync(wrongDigest, JSON.stringify(metadata));
    expect(() => verifyConsumerSnapshotBundle(wrongDigest)).toThrow(/bundle digest mismatch/u);

    metadata.bundle.sha256 = createHash("sha256").update(readFileSync(result.bundle.path)).digest("hex");
    metadata.snapshotCommit = "0".repeat(40);
    const wrongCommit = path.join(path.dirname(result.metadataPath), "wrong-commit.json");
    writeFileSync(wrongCommit, JSON.stringify(metadata));
    expect(() => verifyConsumerSnapshotBundle(wrongCommit)).toThrow(/snapshot commit mismatch/u);
  });

  it("rejects inventories or untracked provenance that do not match the immutable bundle", () => {
    const result = buildConsumerSnapshot({
      label: "cc-mobile",
      outputDirectory: temporaryDirectory(),
      sourceRoot: sourceFixture(),
    });
    const metadata = JSON.parse(readFileSync(result.metadataPath, "utf8"));

    metadata.includedInventory.records[0].sha256 = "0".repeat(64);
    const wrongInventory = path.join(path.dirname(result.metadataPath), "wrong-inventory.json");
    writeFileSync(wrongInventory, JSON.stringify(metadata));
    expect(() => verifyConsumerSnapshotBundle(wrongInventory)).toThrow(/included inventory mismatch/u);

    const original = JSON.parse(readFileSync(result.metadataPath, "utf8"));
    original.untrackedIncludedInventory.records[0].path = "tracked.txt";
    const wrongUntracked = path.join(path.dirname(result.metadataPath), "wrong-untracked.json");
    writeFileSync(wrongUntracked, JSON.stringify(original));
    expect(() => verifyConsumerSnapshotBundle(wrongUntracked)).toThrow(/untracked provenance mismatch/u);
  });

  it("fails and removes partial outputs when the source changes during capture", () => {
    const source = sourceFixture();
    const output = temporaryDirectory();

    expect(() => buildConsumerSnapshot({
      label: "cc-mobile",
      onSnapshotReady() { writeFileSync(path.join(source, "raced.ts"), "changed during capture\n"); },
      outputDirectory: output,
      sourceRoot: source,
    })).toThrow(/source worktree changed during snapshot capture/u);
    expect(existsSync(path.join(output, "cc-mobile.bundle"))).toBe(false);
    expect(existsSync(path.join(output, "cc-mobile.json"))).toBe(false);
  });

  it("rejects a same-path dirty content mutation even when porcelain status is unchanged", () => {
    const source = sourceFixture();
    const output = temporaryDirectory();
    writeFileSync(path.join(source, "tracked.txt"), "dirty-one\n");

    expect(() => buildConsumerSnapshot({
      label: "cc-mobile",
      onSnapshotReady() { writeFileSync(path.join(source, "tracked.txt"), "dirty-two\n"); },
      outputDirectory: output,
      sourceRoot: source,
    })).toThrow(/source content or mode changed during snapshot capture/u);
    expect(existsSync(path.join(output, "cc-mobile.bundle"))).toBe(false);
    expect(existsSync(path.join(output, "cc-mobile.json"))).toBe(false);
  });

  it("materializes a verified bundle for consumer gates and cleans the disposable clone", () => {
    const result = buildConsumerSnapshot({
      label: "cc-mobile",
      outputDirectory: temporaryDirectory(),
      sourceRoot: sourceFixture(),
    });
    const prepared = prepareConsumerInput(result.metadataPath);

    expect(git(prepared.source, ["rev-parse", "origin/main^{commit}"])).toBe(result.snapshotCommit);
    expect(prepared.provenance.snapshotTree).toBe(result.snapshotTree);
    const summary = summarizeConsumerSnapshotProvenance(prepared.provenance);
    expect(summary.bundle.path).toBe(path.relative(process.cwd(), result.bundle.path));
    expect(summary.metadataPath).toBe(path.relative(process.cwd(), result.metadataPath));
    expect(summary.bundle.verified.includedInventory).toEqual({
      count: result.includedInventory.count,
      sha256: result.includedInventory.sha256,
    });
    expect(JSON.stringify(summary)).not.toContain('"records"');
    prepared.cleanup();
    expect(() => readFileSync(path.join(prepared.source, "package.json"))).toThrow();
  });

  it("isolates child Git commands from hook-inherited repository environment", () => {
    const inheritedRepository = sourceFixture();
    const source = sourceFixture();
    writeFileSync(path.join(source, "source-only.txt"), "source-only\n");
    git(source, ["add", "source-only.txt"]);
    git(source, ["commit", "-q", "-m", "source-only"]);
    const expectedBase = git(source, ["rev-parse", "HEAD"]);
    const previous = {
      GIT_COMMON_DIR: process.env.GIT_COMMON_DIR,
      GIT_DIR: process.env.GIT_DIR,
      GIT_WORK_TREE: process.env.GIT_WORK_TREE,
    };
    process.env.GIT_DIR = path.join(inheritedRepository, ".git");
    process.env.GIT_COMMON_DIR = path.join(inheritedRepository, ".git");
    process.env.GIT_WORK_TREE = inheritedRepository;
    try {
      const result = buildConsumerSnapshot({
        label: "cc-mobile",
        outputDirectory: temporaryDirectory(),
        sourceRoot: source,
      });
      expect(result.baseRevision).toBe(expectedBase);
      expect(git(inheritedRepository, ["config", "--get", "core.bare"])).toBe("false");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("captures and verifies tracked blobs larger than the default child-process buffer", () => {
    const source = sourceFixture();
    writeFileSync(path.join(source, "large.bin"), Buffer.alloc(2 * 1024 * 1024, 7));
    git(source, ["add", "large.bin"]);
    git(source, ["commit", "-q", "-m", "large blob"]);

    const result = buildConsumerSnapshot({
      label: "cc-mobile",
      outputDirectory: temporaryDirectory(),
      sourceRoot: source,
    });

    expect(verifyConsumerSnapshotBundle(result.metadataPath).tree).toBe(result.snapshotTree);
  });
});

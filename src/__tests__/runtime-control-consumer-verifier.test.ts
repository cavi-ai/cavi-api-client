import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  archiveRevision,
  assertConsumerBase,
  assertInstalledDependency,
  assertInstalledTarball,
  assertNoSourcePathImports,
  assertSnapshotDependencyProvenance,
  assertWorktreeInvariant,
  consumerSnapshotProvenanceRecord,
  lockRecordsTarball,
  materializeLockedFileTarball,
  verifyArtifactDigest,
  withPreparedConsumerInputs,
} from "../../scripts/runtime-control/verify-consumers.mjs";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "runtime-control-consumer-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function installedDependencyFixture(
  dependency: "@cavi-ai/api-client" | "@cavi/api-client",
  options: { wrongResolvedTarget?: boolean } = {},
) {
  const directory = temporaryDirectory();
  const tarball = path.join(directory, "runtime-control-rc.tgz");
  writeFileSync(tarball, "approved-release-candidate");
  const bytes = readFileSync(tarball);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({
    dependencies: { [dependency]: "file:./runtime-control-rc.tgz" },
  }));
  const lockVersion = dependency === "@cavi/api-client"
    ? "'@cavi-ai/api-client@file:runtime-control-rc.tgz'"
    : "file:runtime-control-rc.tgz";
  writeFileSync(path.join(directory, "pnpm-lock.yaml"), [
    "lockfileVersion: '9.0'",
    "importers:",
    "  .:",
    "    dependencies:",
    `      '${dependency}':`,
    "        specifier: file:./runtime-control-rc.tgz",
    `        version: ${lockVersion}`,
    "packages:",
    "  '@cavi-ai/api-client@file:runtime-control-rc.tgz':",
    `    resolution: {integrity: ${integrity}}`,
    "",
  ].join("\n"));

  const storeKey = options.wrongResolvedTarget
    ? "@cavi-ai+api-client@0.10.1"
    : "@cavi-ai+api-client@file+runtime-control-rc.tgz";
  const installedPackage = path.join(
    directory,
    "node_modules/.pnpm",
    storeKey,
    "node_modules/@cavi-ai/api-client",
  );
  mkdirSync(installedPackage, { recursive: true });
  writeFileSync(path.join(installedPackage, "package.json"), JSON.stringify({
    name: "@cavi-ai/api-client",
    version: options.wrongResolvedTarget ? "0.10.1" : "0.11.0",
  }));
  const dependencyLink = path.join(directory, "node_modules", ...dependency.split("/"));
  mkdirSync(path.dirname(dependencyLink), { recursive: true });
  symlinkSync(path.relative(path.dirname(dependencyLink), installedPackage), dependencyLink);
  return { directory, integrity, sha256, tarball };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("runtime-control consumer verifier guardrails", () => {
  it("rejects a release candidate digest mismatch", () => {
    const directory = temporaryDirectory();
    const tarball = path.join(directory, "candidate.tgz");
    writeFileSync(tarball, "release-candidate");

    expect(() => verifyArtifactDigest(tarball, "0".repeat(64))).toThrow(/digest mismatch/u);
  });

  it("rejects a missing clean consumer base", () => {
    expect(() => assertConsumerBase(path.join(temporaryDirectory(), "missing"))).toThrow(/consumer base/u);
  });

  it("rejects source-path imports from a disposable consumer", () => {
    const directory = temporaryDirectory();
    mkdirSync(path.join(directory, "src"));
    writeFileSync(
      path.join(directory, "src/client.ts"),
      'import { RuntimeClient } from "../../packages/cavi-api-client/src/index.ts";\n',
    );

    expect(() => assertNoSourcePathImports(directory)).toThrow(/source-path import/u);
  });

  it("rejects a dependency that resolves to a different tarball", () => {
    const directory = temporaryDirectory();
    const expected = path.join(directory, "expected.tgz");
    const other = path.join(directory, "other.tgz");
    writeFileSync(expected, "expected");
    writeFileSync(other, "other");
    const expectedDigest = createHash("sha256").update(readFileSync(expected)).digest("hex");

    expect(() => assertInstalledTarball(other, expectedDigest)).toThrow(/installed dependency digest/u);
  });

  it("accepts the installed direct file-tarball dependency", () => {
    const fixture = installedDependencyFixture("@cavi-ai/api-client");

    expect(assertInstalledDependency(
      fixture.directory,
      "@cavi-ai/api-client",
      fixture.tarball,
      fixture.sha256,
    )).toEqual({ integrity: fixture.integrity, resolvedPackage: "@cavi-ai/api-client" });
  });

  it("accepts the installed pnpm alias resolving the canonical package", () => {
    const fixture = installedDependencyFixture("@cavi/api-client");

    expect(assertInstalledDependency(
      fixture.directory,
      "@cavi/api-client",
      fixture.tarball,
      fixture.sha256,
    )).toEqual({ integrity: fixture.integrity, resolvedPackage: "@cavi-ai/api-client" });
  });

  it("rejects an installed dependency whose resolved target is different", () => {
    const fixture = installedDependencyFixture("@cavi-ai/api-client", { wrongResolvedTarget: true });

    expect(() => assertInstalledDependency(
      fixture.directory,
      "@cavi-ai/api-client",
      fixture.tarball,
      fixture.sha256,
    )).toThrow("installed dependency provenance does not match the release candidate tarball: localResolution");
  });

  it("requires the captured manifest and lock to retain the exact final RC integrity", () => {
    const fixture = installedDependencyFixture("@cavi-ai/api-client");
    expect(assertSnapshotDependencyProvenance(
      fixture.directory,
      "@cavi-ai/api-client",
      fixture.tarball,
      fixture.sha256,
    )).toMatchObject({ integrity: fixture.integrity });

    writeFileSync(path.join(fixture.directory, "pnpm-lock.yaml"), "stale lock\n");
    expect(() => assertSnapshotDependencyProvenance(
      fixture.directory,
      "@cavi-ai/api-client",
      fixture.tarball,
      fixture.sha256,
    )).toThrow(/captured dependency provenance/u);
  });

  it("accepts an exact absolute final RC specifier without rewriting the snapshot", () => {
    const fixture = installedDependencyFixture("@cavi-ai/api-client");
    const absoluteSpecifier = `file:${fixture.tarball}`;
    writeFileSync(path.join(fixture.directory, "package.json"), JSON.stringify({
      dependencies: { "@cavi-ai/api-client": absoluteSpecifier },
    }));
    const lockPath = path.join(fixture.directory, "pnpm-lock.yaml");
    writeFileSync(lockPath, readFileSync(lockPath, "utf8").replaceAll("file:./runtime-control-rc.tgz", absoluteSpecifier));

    expect(assertSnapshotDependencyProvenance(
      fixture.directory,
      "@cavi-ai/api-client",
      fixture.tarball,
      fixture.sha256,
    )).toEqual({ integrity: fixture.integrity });
  });

  it("materializes the RC at the unchanged lock's captured relative resolution", () => {
    const directory = path.join(temporaryDirectory(), "consumer/.worktrees/runtime-control-sync");
    mkdirSync(directory, { recursive: true });
    const tarball = path.join(temporaryDirectory(), "final-runtime-control.tgz");
    writeFileSync(tarball, "approved-release-candidate");
    const lock = "'@cavi-ai/api-client@file:../../../packages/cavi-api-client/final-runtime-control.tgz':\n";

    const materialized = materializeLockedFileTarball(directory, lock, tarball);

    expect(materialized).toBe(path.resolve(directory, "../../../packages/cavi-api-client/final-runtime-control.tgz"));
    expect(realpathSync(materialized)).toBe(realpathSync(tarball));
    expect(readFileSync(materialized, "utf8")).toBe("approved-release-candidate");
  });

  it("marks committed snapshot provenance as local-only ignored evidence", () => {
    const provenance = {
      algorithm: { id: "fixture" },
      bundle: { path: ".artifacts/fixture.bundle", sha256: "a".repeat(64) },
      includedInventory: { count: 1, sha256: "b".repeat(64) },
      untrackedIncludedInventory: { count: 1, sha256: "c".repeat(64) },
      verified: {
        bundleSha256: "a".repeat(64),
        commit: "d".repeat(40),
        includedInventory: { count: 1, sha256: "b".repeat(64) },
        tree: "e".repeat(40),
        untrackedIncludedInventory: { count: 1, sha256: "c".repeat(64) },
      },
    };

    expect(consumerSnapshotProvenanceRecord([provenance])).toMatchObject({
      availability: "maintainer-local-ignored-artifact",
      localOnly: true,
    });
  });

  it("detects an exact source worktree status mutation", () => {
    const before = Buffer.from(" M existing.ts\n");
    const after = Buffer.from(" M existing.ts\n?? mutation.ts\n");

    expect(() => assertWorktreeInvariant("fixture", before, after)).toThrow(/worktree changed/u);
  });

  it("archives the pinned commit instead of the symbolic remote ref", () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const pinnedRevision = "a".repeat(40);
    const fakeSpawn = (command: string, args: string[]) => {
      calls.push({ command, args });
      return { status: 0, stdout: Buffer.from("archive") };
    };

    archiveRevision("/source", "/destination", pinnedRevision, fakeSpawn);

    expect(calls[0]).toMatchObject({
      command: "git",
      args: ["archive", "--format=tar", pinnedRevision],
    });
    expect(calls[0]?.args).not.toContain("origin/main");
  });

  it("recognizes pnpm alias lock versions backed by the local tarball", () => {
    const integrity = "sha512-approved";
    const lock = [
      "specifier: file:./runtime-control-rc.tgz",
      "version: '@cavi-ai/api-client@file:runtime-control-rc.tgz'",
      "'@cavi-ai/api-client@file:runtime-control-rc.tgz':",
      `  resolution: {integrity: ${integrity}}`,
    ].join("\n");

    expect(lockRecordsTarball(lock, integrity)).toBe(true);
  });

  it("does not accept matching integrity from an unrelated lock entry", () => {
    const integrity = "sha512-approved";
    const lock = [
      "specifier: file:./runtime-control-rc.tgz",
      "version: '@cavi-ai/api-client@file:runtime-control-rc.tgz'",
      "'@cavi-ai/api-client@file:runtime-control-rc.tgz':",
      "  resolution: {integrity: sha512-wrong}",
      "unrelated@1.0.0:",
      `  resolution: {integrity: ${integrity}}`,
    ].join("\n");

    expect(lockRecordsTarball(lock, integrity)).toBe(false);
  });

  it("cleans the first prepared snapshot when preparing the second fails", () => {
    const cleaned: string[] = [];
    const prepare = (input: string) => {
      if (input === "mobile") throw new Error("second prepare failed");
      return { cleanup() { cleaned.push(input); }, provenance: null, source: input };
    };

    expect(() => withPreparedConsumerInputs({ mobile: "mobile", web: "web" }, () => undefined, prepare))
      .toThrow("second prepare failed");
    expect(cleaned).toEqual(["web"]);
  });

  it("cleans both prepared snapshots when a later verifier guard fails", () => {
    const cleaned: string[] = [];
    const prepare = (input: string) => ({
      cleanup() { cleaned.push(input); },
      provenance: null,
      source: input,
    });

    expect(() => withPreparedConsumerInputs({ mobile: "mobile", web: "web" }, () => {
      throw new Error("later guard failed");
    }, prepare)).toThrow("later guard failed");
    expect(cleaned).toEqual(["mobile", "web"]);
  });

  it("still cleans the first snapshot when cleanup of the second throws", () => {
    const cleaned: string[] = [];
    const prepare = (input: string) => ({
      cleanup() {
        cleaned.push(input);
        if (input === "mobile") throw new Error("mobile cleanup failed");
      },
      provenance: null,
      source: input,
    });

    expect(() => withPreparedConsumerInputs({ mobile: "mobile", web: "web" }, () => undefined, prepare))
      .toThrow("mobile cleanup failed");
    expect(cleaned).toEqual(["mobile", "web"]);
  });
});

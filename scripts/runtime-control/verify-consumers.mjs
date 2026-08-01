import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isolatedGitEnvironment, verifyConsumerSnapshotBundle } from "./build-consumer-snapshot.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidencePath = path.join(packageRoot, ".artifacts/runtime-control/runtime-control-release-candidate.json");
const sourceImportPattern = /(?:\.\.\/)+(?:packages\/)?cavi-api-client\/src(?:\/|["'])|cavi-api-client\/\.\.\/src(?:\/|["'])/u;

function digest(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export function verifyArtifactDigest(tarball, expectedDigest) {
  if (!existsSync(tarball)) throw new Error("release candidate tarball is missing");
  const observed = digest(tarball);
  if (observed !== expectedDigest) {
    throw new Error(`release candidate digest mismatch: expected ${expectedDigest}, observed ${observed}`);
  }
  return observed;
}

export function assertConsumerBase(consumerRoot) {
  if (!existsSync(path.join(consumerRoot, ".git"))) throw new Error("consumer base must be an existing git worktree");
  const result = spawnSync("git", ["rev-parse", "--verify", "origin/main^{commit}"], {
    cwd: consumerRoot,
    encoding: "utf8",
  });
  if (result.status !== 0 || !/^[0-9a-f]{40}\n?$/u.test(result.stdout ?? "")) {
    throw new Error("consumer base must contain a valid origin/main revision");
  }
  return result.stdout.trim();
}

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...sourceFiles(target));
    else if (/\.(?:[cm]?[jt]sx?)$/u.test(entry.name) && lstatSync(target).size <= 2_000_000) files.push(target);
  }
  return files;
}

export function assertNoSourcePathImports(consumerRoot) {
  const offenders = sourceFiles(consumerRoot)
    .filter((file) => sourceImportPattern.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(consumerRoot, file));
  if (offenders.length > 0) throw new Error(`source-path import detected: ${offenders.join(", ")}`);
  return [];
}

export function assertInstalledTarball(resolvedTarball, expectedDigest) {
  const observed = digest(resolvedTarball);
  if (observed !== expectedDigest) {
    throw new Error(`installed dependency digest mismatch: expected ${expectedDigest}, observed ${observed}`);
  }
  return observed;
}

export function lockRecordsTarball(lock, integrity) {
  const lockSpecifier = lock.includes("specifier: file:./runtime-control-rc.tgz")
    || lock.includes("specifier: file:runtime-control-rc.tgz");
  const lockVersion = /version: ['"]?(?:@cavi-ai\/api-client@)?file:\.?\/?runtime-control-rc\.tgz['"]?/u.test(lock);
  const lines = lock.split("\n");
  const resolutionIntegrity = lines.some((line, index) => (
    /@cavi-ai\/api-client@file:\.?\/?runtime-control-rc\.tgz['"]?:\s*$/u.test(line)
    && (lines[index + 1] ?? "").includes(`integrity: ${integrity}`)
  ));
  return lockSpecifier && lockVersion && resolutionIntegrity;
}

export function lockRecordsFileTarball(lock, specifier, integrity, tarball) {
  const basename = path.basename(tarball);
  const lines = lock.split("\n");
  const lockSpecifier = lines.some((line) => line.trim() === `specifier: ${specifier}`
    || line.trim() === `specifier: '${specifier}'`
    || line.trim() === `specifier: "${specifier}"`);
  const resolutionIntegrity = lines.some((line, index) => (
    line.includes("@cavi-ai/api-client@file:")
    && line.includes(basename)
    && lines.slice(index, index + 3).some((candidate) => candidate.includes(`integrity: ${integrity}`))
  ));
  return lockSpecifier && resolutionIntegrity;
}

export function materializeLockedFileTarball(consumerRoot, lock, tarball) {
  const escapedBasename = path.basename(tarball).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const relativeResolution = [...lock.matchAll(new RegExp(`file:([^\\s'\"()]*${escapedBasename})`, "gu"))]
    .map((match) => match[1])
    .find((candidate) => candidate.startsWith(".."));
  if (relativeResolution === undefined) throw new Error("captured lock has no relative final RC resolution");
  const destination = path.resolve(consumerRoot, relativeResolution);
  mkdirSync(path.dirname(destination), { recursive: true });
  symlinkSync(tarball, destination);
  return destination;
}

function capturedFileSpecifier(consumerRoot, dependency, tarball) {
  const pkg = JSON.parse(readFileSync(path.join(consumerRoot, "package.json"), "utf8"));
  const specifier = pkg.dependencies?.[dependency] ?? pkg.devDependencies?.[dependency];
  if (typeof specifier !== "string" || !specifier.startsWith("file:")) return { matches: false, specifier };
  const referenced = path.resolve(consumerRoot, specifier.slice("file:".length));
  return { matches: referenced === path.resolve(tarball), specifier };
}

export function assertInstalledDependency(consumerRoot, dependency, tarball, expectedDigest) {
  assertInstalledTarball(tarball, expectedDigest);
  const lock = readFileSync(path.join(consumerRoot, "pnpm-lock.yaml"), "utf8");
  const integrity = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`;
  const captured = capturedFileSpecifier(consumerRoot, dependency, tarball);
  const installedPath = path.join(consumerRoot, "node_modules", ...dependency.split("/"));
  let installedPackage;
  let resolvedPath;
  try {
    resolvedPath = realpathSync(installedPath);
    installedPackage = JSON.parse(readFileSync(path.join(installedPath, "package.json"), "utf8"));
  } catch {
    throw new Error("installed dependency provenance is missing");
  }
  const localResolution = resolvedPath.includes("@cavi-ai+api-client@file+");
  const lockTarball = typeof captured.specifier === "string"
    && lockRecordsFileTarball(lock, captured.specifier, integrity, tarball);
  const checks = {
    installedName: installedPackage.name === "@cavi-ai/api-client",
    localResolution,
    lockTarball,
    manifestSpecifier: captured.matches,
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failedChecks.length > 0) {
    throw new Error(`installed dependency provenance does not match the release candidate tarball: ${failedChecks.join(", ")}`);
  }
  return { integrity, resolvedPackage: installedPackage.name };
}

export function assertSnapshotDependencyProvenance(consumerRoot, dependency, tarball, expectedDigest) {
  assertInstalledTarball(tarball, expectedDigest);
  const lock = readFileSync(path.join(consumerRoot, "pnpm-lock.yaml"), "utf8");
  const integrity = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`;
  const captured = capturedFileSpecifier(consumerRoot, dependency, tarball);
  const checks = {
    lockTarball: typeof captured.specifier === "string"
      && lockRecordsFileTarball(lock, captured.specifier, integrity, tarball),
    manifestSpecifier: captured.matches,
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failedChecks.length > 0) {
    throw new Error(`captured dependency provenance does not match the final release candidate: ${failedChecks.join(", ")}`);
  }
  return { integrity };
}

export function captureWorktreeStatus(consumerRoot) {
  const result = spawnSync("git", ["status", "--porcelain=v1"], { cwd: consumerRoot, encoding: "buffer" });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) throw new Error("unable to capture consumer worktree status");
  return result.stdout;
}

function statusDigest(status) {
  return createHash("sha256").update(status).digest("hex");
}

function packageRelativePath(absolutePath) {
  return path.relative(packageRoot, absolutePath).split(path.sep).join("/");
}

export function summarizeConsumerSnapshotProvenance(provenance) {
  const { includedInventory, untrackedIncludedInventory, verified, ...entry } = provenance;
  return {
    ...entry,
    bundle: {
      ...entry.bundle,
      verified: {
        bundleSha256: verified.bundleSha256,
        commit: verified.commit,
        includedInventory: {
          count: verified.includedInventory.count,
          sha256: verified.includedInventory.sha256,
        },
        tree: verified.tree,
        untrackedIncludedInventory: {
          count: verified.untrackedIncludedInventory.count,
          sha256: verified.untrackedIncludedInventory.sha256,
        },
      },
    },
    includedInventory: { count: includedInventory.count, sha256: includedInventory.sha256 },
    untrackedIncludedInventory: {
      count: untrackedIncludedInventory.count,
      sha256: untrackedIncludedInventory.sha256,
    },
  };
}

export function consumerSnapshotProvenanceRecord(snapshotProvenance) {
  return {
    algorithm: snapshotProvenance[0].algorithm,
    availability: "maintainer-local-ignored-artifact",
    consumers: snapshotProvenance.map(summarizeConsumerSnapshotProvenance),
    localOnly: true,
  };
}

export function prepareConsumerInput(input) {
  const resolved = path.resolve(input);
  if (!resolved.endsWith(".json")) return { cleanup() {}, provenance: null, source: resolved };
  const provenance = JSON.parse(readFileSync(resolved, "utf8"));
  const verified = verifyConsumerSnapshotBundle(resolved);
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "runtime-control-consumer-bundle-"));
  const source = path.join(temporaryRoot, "source");
  const bundle = path.resolve(path.dirname(resolved), provenance.bundle.path);
  try {
    const clone = spawnSync("git", ["clone", "-q", bundle, source], {
      encoding: "utf8",
      env: isolatedGitEnvironment(),
    });
    if (clone.status !== 0) throw new Error(`unable to materialize consumer snapshot bundle: ${clone.stderr}`);
    const remote = spawnSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], {
      cwd: source,
      encoding: "utf8",
      env: isolatedGitEnvironment(),
    });
    if (remote.status !== 0) throw new Error("unable to pin materialized consumer origin/main");
    return {
      cleanup() { rmSync(temporaryRoot, { force: true, recursive: true }); },
      provenance: {
        ...provenance,
        bundle: { ...provenance.bundle, path: packageRelativePath(bundle) },
        metadataPath: packageRelativePath(resolved),
        verified,
      },
      source,
    };
  } catch (error) {
    rmSync(temporaryRoot, { force: true, recursive: true });
    throw error;
  }
}

export function assertWorktreeInvariant(name, before, after) {
  const beforeSha256 = statusDigest(before);
  const afterSha256 = statusDigest(after);
  if (!before.equals(after)) throw new Error(`${name} source worktree changed during verification`);
  return { afterSha256, beforeSha256, name, status: "passed" };
}

function execute(command, args, cwd, displayArgs = args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "inherit" });
  return {
    command: [command, ...displayArgs].join(" "),
    exitCode: result.status ?? 1,
    status: result.status === 0 ? "passed" : "failed",
  };
}

export function archiveRevision(source, destination, revision, spawn = spawnSync) {
  const archive = spawn("git", ["archive", "--format=tar", revision], {
    cwd: source,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (archive.status !== 0) throw new Error("unable to archive consumer origin/main");
  const extraction = spawn("tar", ["-xf", "-", "-C", destination], { input: archive.stdout });
  if (extraction.status !== 0) throw new Error("unable to extract disposable consumer copy");
}

function verifyConsumer({ name, source, dependency, revision, tree, tarball, expectedDigest, gates }) {
  const temporaryContainer = mkdtempSync(path.join(tmpdir(), `runtime-control-${name}-`));
  const temporaryRoot = path.join(temporaryContainer, "consumer/.worktrees/runtime-control-sync");
  mkdirSync(temporaryRoot, { recursive: true });
  const layers = [];
  try {
    archiveRevision(source, temporaryRoot, revision);
    assertSnapshotDependencyProvenance(temporaryRoot, dependency, tarball, expectedDigest);
    const lock = readFileSync(path.join(temporaryRoot, "pnpm-lock.yaml"), "utf8");
    const lockedTarball = materializeLockedFileTarball(temporaryRoot, lock, tarball);
    assertInstalledTarball(lockedTarball, expectedDigest);
    assertNoSourcePathImports(temporaryRoot);
    layers.push({ command: "source import boundary scan", exitCode: 0, status: "passed" });

    const install = execute("pnpm", ["install", "--frozen-lockfile"], temporaryRoot);
    layers.push(install);
    if (install.exitCode !== 0) return { name, revision, tree, status: "failed", failureLayer: "install", layers };

    assertInstalledDependency(temporaryRoot, dependency, tarball, expectedDigest);
    layers.push({ command: "installed release candidate digest verification", exitCode: 0, status: "passed" });
    let failureLayer;
    for (const gate of gates) {
      const result = execute("pnpm", gate.args, temporaryRoot);
      layers.push(result);
      if (result.exitCode !== 0 && failureLayer === undefined) failureLayer = gate.layer;
    }
    if (failureLayer !== undefined) return { name, revision, tree, status: "failed", failureLayer, layers };
    return { name, revision, tree, status: "passed", layers };
  } catch (error) {
    layers.push({ command: "verifier guardrail", exitCode: 1, status: "failed", summary: error instanceof Error ? error.message : String(error) });
    return { name, revision, tree, status: "failed", failureLayer: "guardrail", layers };
  } finally {
    rmSync(temporaryContainer, { recursive: true, force: true });
  }
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!["--web", "--mobile"].includes(flag) || !argv[index + 1]) throw new Error("usage: verify-consumers.mjs --web <path> --mobile <path>");
    values[flag.slice(2)] = path.resolve(argv[index + 1]);
  }
  if (!values.web || !values.mobile) throw new Error("both --web and --mobile consumer bases are required");
  return values;
}

export function withPreparedConsumerInputs({ web, mobile }, operation, prepare = prepareConsumerInput) {
  let preparedWeb;
  let preparedMobile;
  try {
    preparedWeb = prepare(web);
    preparedMobile = prepare(mobile);
    return operation({ mobile: preparedMobile, web: preparedWeb });
  } finally {
    try {
      preparedMobile?.cleanup();
    } finally {
      preparedWeb?.cleanup();
    }
  }
}

function verifyPreparedConsumers(prepared) {
  const manifest = JSON.parse(readFileSync(evidencePath, "utf8"));
  const tarball = path.resolve(packageRoot, manifest.tarball.path);
  const expectedDigest = manifest.tarball.sha256;
  const sourceBefore = {
    "cavi-control": captureWorktreeStatus(prepared.web.source),
    "cc-mobile": captureWorktreeStatus(prepared.mobile.source),
  };
  const observedDigest = verifyArtifactDigest(tarball, expectedDigest);
  const webRevision = assertConsumerBase(prepared.web.source);
  const mobileRevision = assertConsumerBase(prepared.mobile.source);
  const webTree = spawnSync("git", ["rev-parse", `${webRevision}^{tree}`], { cwd: prepared.web.source, encoding: "utf8" }).stdout.trim();
  const mobileTree = spawnSync("git", ["rev-parse", `${mobileRevision}^{tree}`], { cwd: prepared.mobile.source, encoding: "utf8" }).stdout.trim();
  let consumers;
  let sourceAfter;
  try {
    consumers = [
    verifyConsumer({
      name: "cavi-control",
      source: prepared.web.source,
      dependency: "@cavi-ai/api-client",
      revision: webRevision,
      tree: webTree,
      tarball,
      expectedDigest,
      gates: [
        { layer: "typecheck", args: ["run", "typecheck"] },
        { layer: "import-boundary", args: ["run", "verify:apis"] },
        { layer: "unit", args: ["test"] },
      ],
    }),
    verifyConsumer({
      name: "cc-mobile",
      source: prepared.mobile.source,
      dependency: "@cavi/api-client",
      revision: mobileRevision,
      tree: mobileTree,
      tarball,
      expectedDigest,
      gates: [
        { layer: "typecheck", args: ["exec", "tsc", "--noEmit"] },
        { layer: "import-boundary", args: ["run", "test:api-client-import-surface"] },
        { layer: "unit", args: ["run", "test:mobile-hardening-contracts"] },
      ],
    }),
    ];
  } finally {
    sourceAfter = {
      "cavi-control": captureWorktreeStatus(prepared.web.source),
      "cc-mobile": captureWorktreeStatus(prepared.mobile.source),
    };
  }
  const sourceWorktrees = Object.keys(sourceBefore).map((name) => {
    try {
      return assertWorktreeInvariant(name, sourceBefore[name], sourceAfter[name]);
    } catch {
      return {
        afterSha256: statusDigest(sourceAfter[name]),
        beforeSha256: statusDigest(sourceBefore[name]),
        name,
        status: "failed",
      };
    }
  });
  const sourcesUnchanged = sourceWorktrees.every((source) => source.status === "passed");
  manifest.consumerVerification = {
    artifactSha256: observedDigest,
    command: "node scripts/runtime-control/verify-consumers.mjs --web <cavi-control-worktree> --mobile <cc-mobile-worktree>",
    consumers,
    snapshotWorktreeInvariance: sourceWorktrees,
    status: consumers.every((consumer) => consumer.status === "passed") && sourcesUnchanged ? "passed" : "failed",
  };
  const snapshotProvenance = [prepared.web.provenance, prepared.mobile.provenance].filter(Boolean);
  if (snapshotProvenance.length > 0) {
    manifest.consumerSnapshotProvenance = consumerSnapshotProvenanceRecord(snapshotProvenance);
  }
  writeFileSync(evidencePath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest.consumerVerification, null, 2));
  if (manifest.consumerVerification.status !== "passed") process.exitCode = 1;
  return manifest.consumerVerification;
}

export function verifyConsumers({ web, mobile }) {
  return withPreparedConsumerInputs({ web, mobile }, verifyPreparedConsumers);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  verifyConsumers(parseArguments(process.argv.slice(2)));
}

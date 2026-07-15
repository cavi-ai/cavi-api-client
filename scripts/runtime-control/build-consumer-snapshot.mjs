import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export const SNAPSHOT_ALGORITHM_ID = "runtime-control-consumer-snapshot-v1";
export const DEFAULT_SNAPSHOT_EXCLUSIONS = Object.freeze([
  ".agents", ".artifacts", ".claude", ".cursor", ".debug-chromium-proof", ".e2e-pipeline",
  ".expo", ".gemini", ".git", ".kiro", ".pnpm-store", ".qoder", ".remember",
  ".superpowers", ".vite", ".worktrees", "android/build", "build", "coverage", "dist",
  "docs/superpowers", "ios/build", "node_modules", "playwright-report", "registry", "test-results",
]);

const PRIVATE_WORKSTATION_PATH = /(?:file:\/\/\/)?(?:\/Users\/|\/Volumes\/|\/private\/tmp\/)[^\s"'`<>()\[\]{}]+|[A-Za-z]:\\Users\\[^\s"'`<>()\[\]{}]+/gu;

const GIT_REPOSITORY_ENVIRONMENT_KEYS = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_WORK_TREE",
];

export function isolatedGitEnvironment(environment = process.env) {
  const isolated = { ...environment };
  for (const key of GIT_REPOSITORY_ENVIRONMENT_KEYS) delete isolated[key];
  return isolated;
}

function run(command, args, cwd, options = {}) {
  const environment = command === "git" ? isolatedGitEnvironment(options.env) : (options.env ?? process.env);
  const result = spawnSync(command, args, {
    cwd,
    encoding: options.encoding ?? "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
    env: environment,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || "unknown error"}`);
  return result.stdout;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function inventoryFromRecords(records) {
  const sortedRecords = [...records].sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  const digest = createHash("sha256");
  for (const record of sortedRecords) digest.update(`${record.path}\0${record.mode}\0${record.sha256}\n`);
  return { count: sortedRecords.length, records: sortedRecords, sha256: digest.digest("hex") };
}

function inventoryFromFilesystem(root, paths) {
  return inventoryFromRecords(paths.map((relativePath) => {
    const file = path.join(root, relativePath);
    const stat = lstatSync(file);
    const mode = stat.isSymbolicLink() ? "120000" : ((stat.mode & 0o111) === 0 ? "100644" : "100755");
    const bytes = stat.isSymbolicLink() ? Buffer.from(readlinkSync(file)) : readFileSync(file);
    return { mode, path: relativePath, sha256: sha256(bytes) };
  }));
}

function pathSetDigest(paths) {
  const digest = createHash("sha256");
  for (const relativePath of [...paths].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))) {
    digest.update(relativePath);
    digest.update("\0");
  }
  return digest.digest("hex");
}

function inventoryFromGitTree(repository, revision, selectedPaths) {
  const entries = run("git", ["ls-tree", "-rz", "--full-tree", revision], repository, { encoding: "buffer" })
    .toString("utf8").split("\0").filter(Boolean).map((entry) => {
      const match = /^(\d+) blob ([0-9a-f]+)\t([\s\S]+)$/u.exec(entry);
      if (!match) throw new Error(`unsupported snapshot tree entry: ${entry}`);
      return { mode: match[1], object: match[2], path: match[3] };
    });
  const selected = selectedPaths === undefined
    ? entries
    : selectedPaths.map((relativePath) => {
      const entry = entries.find((candidate) => candidate.path === relativePath);
      if (!entry) throw new Error(`untracked provenance path is absent from snapshot tree: ${relativePath}`);
      return entry;
    });
  return inventoryFromRecords(selected.map((entry) => ({
    mode: entry.mode,
    path: entry.path,
    sha256: sha256(run("git", ["cat-file", "blob", entry.object], repository, { encoding: "buffer" })),
  })));
}

function assertInventory(name, expected, observed) {
  if (JSON.stringify(expected) !== JSON.stringify(observed)) throw new Error(`${name} mismatch with immutable snapshot tree`);
}

function status(root) {
  return run("git", ["status", "--porcelain=v1", "-z"], root, { encoding: "buffer" });
}

function isExcluded(relativePath, exclusions) {
  return exclusions.some((excluded) => relativePath === excluded
    || relativePath.startsWith(`${excluded}/`)
    || relativePath.split("/").includes(excluded));
}

function listedPaths(root, args) {
  return run("git", [...args, "-z"], root, { encoding: "buffer" })
    .toString("utf8").split("\0").filter(Boolean);
}

function copyEntry(sourceRoot, destinationRoot, relativePath) {
  const source = path.join(sourceRoot, relativePath);
  if (!existsSync(source)) return false;
  const destination = path.join(destinationRoot, relativePath);
  const stat = lstatSync(source);
  mkdirSync(path.dirname(destination), { recursive: true });
  if (stat.isSymbolicLink()) symlinkSync(readlinkSync(source), destination);
  else {
    copyFileSync(source, destination);
    chmodSync(destination, stat.mode & 0o777);
  }
  return true;
}

function privateWorkstationPaths(bytes) {
  if (bytes.includes(0)) return new Set();
  return new Set(bytes.toString("utf8").match(PRIVATE_WORKSTATION_PATH) ?? []);
}

function baseEntryBytes(source, baseRevision, relativePath) {
  const result = spawnSync("git", ["show", `${baseRevision}:${relativePath}`], {
    cwd: source,
    encoding: "buffer",
    env: isolatedGitEnvironment(),
    maxBuffer: 128 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : Buffer.alloc(0);
}

function assertPrivacySafeSnapshot(root, includedPaths, { allowedAbsolutePaths, baseRevision, source }) {
  const explicitlyAllowed = new Set(allowedAbsolutePaths.flatMap((entry) => [entry, `file://${entry}`]));
  for (const relativePath of includedPaths) {
    const file = path.join(root, relativePath);
    const stat = lstatSync(file);
    const bytes = stat.isSymbolicLink() ? Buffer.from(readlinkSync(file)) : readFileSync(file);
    const basePaths = privateWorkstationPaths(baseEntryBytes(source, baseRevision, relativePath));
    const introduced = [...privateWorkstationPaths(bytes)]
      .filter((entry) => !basePaths.has(entry) && !explicitlyAllowed.has(entry));
    if (introduced.length > 0) throw new Error(`new private workstation path in snapshot: ${relativePath}`);
  }
}

function writeBundle(repository, destination) {
  run("git", ["bundle", "create", destination, "HEAD"], repository);
  return sha256(readFileSync(destination));
}

export function verifyConsumerSnapshotBundle(metadataPath, expectedSha256) {
  const absoluteMetadata = path.resolve(metadataPath);
  const metadata = JSON.parse(readFileSync(absoluteMetadata, "utf8"));
  const bundlePath = path.resolve(path.dirname(absoluteMetadata), metadata.bundle.path);
  const observedDigest = sha256(readFileSync(bundlePath));
  const approvedDigest = expectedSha256 ?? metadata.bundle.sha256;
  if (observedDigest !== approvedDigest) throw new Error(`bundle digest mismatch: expected ${approvedDigest}, observed ${observedDigest}`);
  const verificationRoot = mkdtempSync(path.join(tmpdir(), "runtime-control-bundle-verify-"));
  try {
    run("git", ["init", "-q"], verificationRoot);
    run("git", ["bundle", "verify", bundlePath], verificationRoot);
    const heads = run("git", ["bundle", "list-heads", bundlePath], verificationRoot).trim().split(/\s+/u);
    const commit = heads[0];
    if (commit !== metadata.snapshotCommit) throw new Error(`snapshot commit mismatch: expected ${metadata.snapshotCommit}, observed ${commit}`);
    run("git", ["fetch", "-q", bundlePath, "HEAD"], verificationRoot);
    const tree = run("git", ["rev-parse", "FETCH_HEAD^{tree}"], verificationRoot).trim();
    if (tree !== metadata.snapshotTree) throw new Error(`snapshot tree mismatch: expected ${metadata.snapshotTree}, observed ${tree}`);
    const includedInventory = inventoryFromGitTree(verificationRoot, "FETCH_HEAD");
    assertInventory("included inventory", metadata.includedInventory, includedInventory);
    const untrackedPaths = metadata.untrackedIncludedInventory.records.map((record) => record.path);
    if (new Set(untrackedPaths).size !== untrackedPaths.length) throw new Error("untracked provenance mismatch: duplicate path");
    const message = run("git", ["show", "-s", "--format=%B", "FETCH_HEAD"], verificationRoot);
    const recordedPathDigest = /^Runtime-Control-Untracked-Paths-SHA256: ([0-9a-f]{64})$/mu.exec(message)?.[1];
    if (!recordedPathDigest
      || recordedPathDigest !== metadata.untrackedPathsSha256
      || recordedPathDigest !== pathSetDigest(untrackedPaths)) {
      throw new Error("untracked provenance mismatch with immutable snapshot commit");
    }
    const untrackedIncludedInventory = inventoryFromGitTree(verificationRoot, "FETCH_HEAD", untrackedPaths);
    assertInventory("untracked provenance", metadata.untrackedIncludedInventory, untrackedIncludedInventory);
    return { bundleSha256: observedDigest, commit, includedInventory, tree, untrackedIncludedInventory };
  } finally {
    rmSync(verificationRoot, { force: true, recursive: true });
  }
}

export function buildConsumerSnapshot({
  allowedAbsolutePaths = [], exclusions = [], expectedBaseRevision, expectedOrigin, label, onSnapshotReady, outputDirectory, sourceRoot,
}) {
  if (!label || !/^[a-z0-9][a-z0-9._-]*$/u.test(label)) throw new Error("snapshot label must be filesystem-safe");
  const source = realpathSync(sourceRoot);
  const output = path.resolve(outputDirectory);
  const effectiveExclusions = [...new Set([
    ...DEFAULT_SNAPSHOT_EXCLUSIONS,
    ...exclusions,
  ])].sort();
  const before = status(source);
  const baseRevision = run("git", ["rev-parse", "HEAD^{commit}"], source).trim();
  const sourceOrigin = run("git", ["config", "--get", "remote.origin.url"], source).trim();
  if (expectedOrigin !== undefined && sourceOrigin !== expectedOrigin) {
    throw new Error(`snapshot source origin mismatch: expected ${expectedOrigin}, observed ${sourceOrigin}`);
  }
  if (expectedBaseRevision !== undefined && baseRevision !== expectedBaseRevision) {
    throw new Error(`snapshot source base mismatch: expected ${expectedBaseRevision}, observed ${baseRevision}`);
  }
  const tracked = listedPaths(source, ["ls-files", "--cached"]);
  const untracked = listedPaths(source, ["ls-files", "--others", "--exclude-standard"]);
  const included = [...new Set([...tracked, ...untracked])]
    .filter((entry) => !isExcluded(entry, effectiveExclusions) && existsSync(path.join(source, entry)))
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const includedUntracked = untracked.filter((entry) => included.includes(entry));
  const sourceInventoryBefore = inventoryFromFilesystem(source, included);
  const trackedDiffBefore = run("git", ["diff", "--binary", "--no-ext-diff", "HEAD", "--", ".", ":(exclude)test-results/**"], source, { encoding: "buffer" });
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "runtime-control-consumer-snapshot-"));
  mkdirSync(output, { recursive: true });
  const bundlePath = path.join(output, `${label}.bundle`);
  const metadataPath = path.join(output, `${label}.json`);
  rmSync(bundlePath, { force: true });
  rmSync(metadataPath, { force: true });
  try {
    for (const entry of included) copyEntry(source, temporaryRoot, entry);
    assertPrivacySafeSnapshot(temporaryRoot, included, { allowedAbsolutePaths, baseRevision, source });
    const copiedInventory = inventoryFromFilesystem(temporaryRoot, included);
    if (JSON.stringify(sourceInventoryBefore) !== JSON.stringify(copiedInventory)) {
      throw new Error("source content or mode changed while files were copied for snapshot capture");
    }
    run("git", ["init", "-q"], temporaryRoot);
    run("git", ["config", "user.name", "Runtime Control Snapshot v1"], temporaryRoot);
    run("git", ["config", "user.email", "runtime-control-snapshot-v1@localhost"], temporaryRoot);
    run("git", ["add", "-A"], temporaryRoot);
    const untrackedPathsSha256 = pathSetDigest(includedUntracked);
    run("git", ["commit", "-q", "-m", `snapshot-v1: ${label}\n\nRuntime-Control-Untracked-Paths-SHA256: ${untrackedPathsSha256}`], temporaryRoot, {
      env: { ...process.env, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z" },
    });
    const snapshotCommit = run("git", ["rev-parse", "HEAD"], temporaryRoot).trim();
    const snapshotTree = run("git", ["rev-parse", "HEAD^{tree}"], temporaryRoot).trim();
    const bundleSha256 = writeBundle(temporaryRoot, bundlePath);
    onSnapshotReady?.();
    const sourceInventoryAfter = inventoryFromFilesystem(source, included);
    if (JSON.stringify(sourceInventoryBefore) !== JSON.stringify(sourceInventoryAfter)) {
      throw new Error("source content or mode changed during snapshot capture");
    }
    const trackedDiffAfter = run("git", ["diff", "--binary", "--no-ext-diff", "HEAD", "--", ".", ":(exclude)test-results/**"], source, { encoding: "buffer" });
    if (!trackedDiffBefore.equals(trackedDiffAfter)) throw new Error("tracked diff changed during snapshot capture");
    const after = status(source);
    if (!before.equals(after)) throw new Error("source worktree changed during snapshot capture");
    const includedInventory = inventoryFromGitTree(temporaryRoot, "HEAD");
    const untrackedIncludedInventory = inventoryFromGitTree(temporaryRoot, "HEAD", includedUntracked);
    const includedRecord = (relativePath) => includedInventory.records.find((record) => record.path === relativePath);
    const metadata = {
      algorithm: {
        commitIdentity: "Runtime Control Snapshot v1 <runtime-control-snapshot-v1@localhost>",
        commitTimestamp: "2000-01-01T00:00:00Z",
        id: SNAPSHOT_ALGORITHM_ID,
        inventoryEncoding: "path NUL git-mode NUL SHA-256(content-or-symlink-target) newline; UTF-8 byte-order sort",
        untrackedProvenanceEncoding: "sorted untracked path plus NUL; SHA-256 embedded in snapshot commit message",
      },
      allowedAbsolutePathSha256: allowedAbsolutePaths.map((entry) => sha256(Buffer.from(entry))).sort(),
      baseRevision,
      bundle: { path: `${label}.bundle`, sha256: bundleSha256 },
      excluded: effectiveExclusions,
      includedInventory,
      label,
      originalSourceStatus: { afterSha256: sha256(after), beforeSha256: sha256(before), equal: true, format: "git status --porcelain=v1 -z" },
      packageJsonSha256: includedRecord("package.json")?.sha256 ?? null,
      pnpmLockSha256: includedRecord("pnpm-lock.yaml")?.sha256 ?? null,
      snapshotCommit,
      snapshotTree,
      sourceRepository: { baseRevision, origin: sourceOrigin },
      trackedDiffSha256: sha256(trackedDiffBefore),
      untrackedIncludedInventory,
      untrackedPathsSha256,
    };
    writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    verifyConsumerSnapshotBundle(metadataPath);
    return { ...metadata, bundle: { ...metadata.bundle, path: bundlePath }, includedPaths: included, metadataPath };
  } catch (error) {
    rmSync(bundlePath, { force: true });
    rmSync(metadataPath, { force: true });
    throw error;
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function parseArguments(argv) {
  const values = { allowedAbsolutePaths: [], exclusions: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error("usage: build-consumer-snapshot.mjs --source <path> --label <label> --out <directory> [--exclude <path>]");
    if (flag === "--exclude") values.exclusions.push(value);
    else if (flag === "--allow-absolute-path") values.allowedAbsolutePaths.push(value);
    else if (["--source", "--label", "--out", "--expected-origin", "--expected-base"].includes(flag)) values[flag.slice(2)] = value;
    else throw new Error(`unknown option: ${flag}`);
  }
  if (!values.source || !values.label || !values.out) throw new Error("--source, --label, and --out are required");
  return values;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseArguments(process.argv.slice(2));
  const result = buildConsumerSnapshot({
    allowedAbsolutePaths: args.allowedAbsolutePaths,
    exclusions: args.exclusions,
    expectedBaseRevision: args["expected-base"],
    expectedOrigin: args["expected-origin"],
    label: args.label,
    outputDirectory: args.out,
    sourceRoot: args.source,
  });
  console.log(JSON.stringify(result, null, 2));
}

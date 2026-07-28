#!/usr/bin/env node
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDocumentationInTemporaryRoot } from "./build.mjs";
import { normalizedRelativePath } from "./paths.mjs";
import { resolveDocumentationRelease } from "./types.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BLOCK_SIZE = 512;
const NPM_REGISTRY_URL = "https://registry.npmjs.org/";
const MAX_GZIP_TIMESTAMP = 0xffffffff;
const PROHIBITED_ARCHIVE_SEGMENTS = new Set(["package", "src", "dist"]);
const SCOPED_NPM_PACKAGE = /^@(?<scope>[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)\/(?<name>[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)$/u;

/** @param {string} value @param {string} label */
function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`missing required ${label}`);
  return value;
}

/** @param {number | string} value */
function sourceDateEpoch(value) {
  const epoch = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch > MAX_GZIP_TIMESTAMP) {
    throw new Error("invalid SOURCE_DATE_EPOCH");
  }
  return epoch;
}

/** @param {string} packageName */
function artifactPackageStem(packageName) {
  const match = SCOPED_NPM_PACKAGE.exec(packageName);
  if (!match?.groups) throw new Error("invalid scoped npm package name for release artifact");
  const scope = match.groups.scope.replace(/-ai$/u, "");
  if (!scope) throw new Error("invalid scoped npm package name for release artifact");
  return `${scope}-${match.groups.name}`;
}

/** @param {Buffer} buffer */
function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** @param {string} relativePath */
function archivePath(relativePath) {
  return normalizedRelativePath(relativePath, "documentation archive path");
}

/** @param {string} root */
async function collectDocumentationFiles(root) {
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink()) throw new Error("documentation directory must not be a symlink");
  if (!rootStat.isDirectory()) throw new Error("documentation directory must be a directory");
  const resolvedRoot = await realpath(root);
  /** @type {{relativePath: string, contents: Buffer}[]} */
  const files = [];

  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      archivePath(relativePath);
      const prohibitedSegment = relativePath.split("/").find((segment) => PROHIBITED_ARCHIVE_SEGMENTS.has(segment));
      if (prohibitedSegment) {
        throw new Error(`documentation archive rejects prohibited ${prohibitedSegment} path: ${relativePath}`);
      }
      const candidate = path.join(directory, entry.name);
      const stat = await lstat(candidate);
      if (stat.isSymbolicLink()) throw new Error(`documentation archive rejects symlink: ${relativePath}`);
      if (stat.isDirectory()) {
        await visit(candidate, relativePath);
        continue;
      }
      if (!stat.isFile()) throw new Error(`documentation archive rejects non-file: ${relativePath}`);
      const resolved = await realpath(candidate);
      const contained = path.relative(resolvedRoot, resolved);
      if (contained.startsWith("..") || path.isAbsolute(contained)) {
        throw new Error(`documentation archive path escapes generated output: ${relativePath}`);
      }
      files.push({ relativePath, contents: await readFile(resolved) });
    }
  }

  await visit(resolvedRoot, "");
  if (files.length === 0) throw new Error("documentation archive requires generated documentation files");
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

/** @param {{relativePath: string, contents: Buffer}[]} files */
function documentationContentSha256(files) {
  const hash = createHash("sha256");
  for (const { relativePath, contents } of files) {
    const pathBytes = Buffer.from(relativePath, "utf8");
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(contents.length));
    hash.update(pathBytes).update(Buffer.from([0])).update(length).update(contents).update(Buffer.from([0]));
  }
  return hash.digest("hex");
}

/** @param {Buffer} header @param {number} offset @param {number} length @param {string} value */
function writeHeaderString(header, offset, length, value) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`tar header field exceeds ${length} bytes: ${value}`);
  bytes.copy(header, offset);
}

/** @param {Buffer} header @param {number} offset @param {number} length @param {number} value */
function writeHeaderOctal(header, offset, length, value) {
  const encoded = value.toString(8).padStart(length - 1, "0");
  if (encoded.length !== length - 1) throw new Error(`tar header number is too large: ${value}`);
  writeHeaderString(header, offset, length - 1, encoded);
  header[offset + length - 1] = 0;
}

/** @param {string} name */
function splitTarPath(name) {
  const bytes = Buffer.from(name, "utf8");
  if (bytes.length <= 100) return { name, prefix: "" };
  for (let index = name.lastIndexOf("/"); index > 0; index = name.lastIndexOf("/", index - 1)) {
    const prefix = name.slice(0, index);
    const base = name.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(base) <= 100) return { name: base, prefix };
  }
  throw new Error(`documentation archive path is too long: ${name}`);
}

/** @param {{name: string, contents: Buffer, epoch: number}} entry */
function tarEntry(entry) {
  const header = Buffer.alloc(BLOCK_SIZE);
  const split = splitTarPath(entry.name);
  writeHeaderString(header, 0, 100, split.name);
  writeHeaderOctal(header, 100, 8, 0o644);
  writeHeaderOctal(header, 108, 8, 0);
  writeHeaderOctal(header, 116, 8, 0);
  writeHeaderOctal(header, 124, 12, entry.contents.length);
  writeHeaderOctal(header, 136, 12, entry.epoch);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeHeaderString(header, 257, 6, "ustar\0");
  writeHeaderString(header, 263, 2, "00");
  writeHeaderString(header, 345, 155, split.prefix);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  const encodedChecksum = checksum.toString(8).padStart(6, "0");
  writeHeaderString(header, 148, 6, encodedChecksum);
  header[154] = 0;
  header[155] = 0x20;
  const padding = Buffer.alloc((BLOCK_SIZE - (entry.contents.length % BLOCK_SIZE)) % BLOCK_SIZE);
  return Buffer.concat([header, entry.contents, padding]);
}

/** @param {Buffer} bytes */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** @param {Buffer} tar @param {number} epoch */
function gzip(tar, epoch) {
  const header = Buffer.alloc(10);
  header.set([0x1f, 0x8b, 0x08, 0x00]);
  header.writeUInt32LE(epoch >>> 0, 4);
  header[8] = 0;
  header[9] = 255;
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(tar), 0);
  trailer.writeUInt32LE(tar.length >>> 0, 4);
  return Buffer.concat([header, deflateRawSync(tar, { level: 9 }), trailer]);
}

/** @param {string} outputDirectory */
async function prepareOutputDirectory(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const stat = await lstat(outputDirectory);
  if (stat.isSymbolicLink()) throw new Error("release artifact output directory must not be a symlink");
  return realpath(outputDirectory);
}

/** @param {string} target @param {Buffer} contents */
async function writeIfIdenticalOrAbsent(target, contents) {
  try {
    const existing = await readFile(target);
    if (!existing.equals(contents)) throw new Error(`refusing to overwrite non-identical release artifact: ${target}`);
    return;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await writeFile(target, contents, { mode: 0o644 });
      return;
    }
    throw error;
  }
}

/**
 * Build a docs-only immutable artifact from a verified npm package tarball.
 * `documentationDirectory` is an integration-test override for validating a
 * pre-rendered generated directory; normal callers leave it undefined.
 *
 * @param {{root: string, tarball: string, outputDirectory: string, sourceDateEpoch: number | string, release: Record<string, string>, documentationDirectory?: string}} input
 */
export async function buildDocumentationReleaseArtifact(input) {
  const release = resolveDocumentationRelease({
    ...input.release,
    tarball: requiredString(input.tarball, "tarball"),
  });
  const packageStem = artifactPackageStem(release.packageName);
  const epoch = sourceDateEpoch(input.sourceDateEpoch);
  const root = requiredString(input.root, "documentation root");
  const temporaryRoot = input.documentationDirectory ? undefined : await mkdtemp(path.join(tmpdir(), "cavi-docs-release-artifact-"));
  try {
    const documentationDirectory = input.documentationDirectory ?? path.join(temporaryRoot, "generated");
    if (!input.documentationDirectory) {
      await buildDocumentationInTemporaryRoot([
        "--tarball", release.tarball,
        "--out", "generated",
        "--root", path.resolve(root),
        "--source-date-epoch", String(epoch),
        "--version", release.version,
        "--tag", release.tag,
        "--repository", release.repository,
        "--commit", release.commit,
        "--npm-integrity", release.npmIntegrity,
        "--tarball-sha256", release.tarballSha256,
      ], temporaryRoot);
    }
    const documents = await collectDocumentationFiles(documentationDirectory);
    const contentSha256 = documentationContentSha256(documents);
    const manifest = Buffer.from(`${JSON.stringify({
      schemaVersion: 1,
      package: { name: release.packageName, version: release.version },
      npm: { registry: NPM_REGISTRY_URL, integrity: release.npmIntegrity, tarballSha256: release.tarballSha256 },
      source: { repository: release.repository, tag: release.tag, commit: release.commit },
      documentation: { contentSha256 },
      generatedAt: new Date(epoch * 1_000).toISOString(),
    }, null, 2)}\n`, "utf8");
    const archiveEntries = [
      { name: "cavi-release.json", contents: manifest, epoch },
      ...documents.map(({ relativePath, contents }) => ({
        name: `docs/api-client/${release.tag}/${archivePath(relativePath)}`,
        contents,
        epoch,
      })),
    ];
    const artifact = gzip(Buffer.concat([
      ...archiveEntries.map(tarEntry),
      Buffer.alloc(BLOCK_SIZE * 2),
    ]), epoch);
    const artifactSha256 = sha256(artifact);
    const requestedOutputDirectory = path.resolve(requiredString(input.outputDirectory, "output directory"));
    const outputDirectory = await prepareOutputDirectory(requestedOutputDirectory);
    const artifactName = `${packageStem}-docs-${release.tag}.tar.gz`;
    const artifactPath = path.join(outputDirectory, artifactName);
    const sha256Path = `${artifactPath}.sha256`;
    await writeIfIdenticalOrAbsent(artifactPath, artifact);
    await writeIfIdenticalOrAbsent(sha256Path, Buffer.from(`${artifactSha256}\n`, "utf8"));
    return {
      artifactPath: path.join(requestedOutputDirectory, artifactName),
      sha256Path: path.join(requestedOutputDirectory, `${artifactName}.sha256`),
      sha256: artifactSha256,
      contentSha256,
    };
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
}

const HELP = `usage: pnpm run docs:release-artifact -- --tarball <release.tgz> --output <directory> --version <semver> --tag <vsemver> --repository <owner/repo> --commit <sha> --npm-integrity <sha512-base64> --tarball-sha256 <sha256> [--root <repository>] [--source-date-epoch <seconds>] [--dry-run]

Required release inputs: --tarball (or --package), --version, --tag, --repository, --commit, --npm-integrity, and --tarball-sha256. --output is required unless --dry-run is used. --source-date-epoch defaults to SOURCE_DATE_EPOCH and controls every archive timestamp.\n`;

/** @param {string[]} argv */
function parseArguments(argv) {
  const values = {};
  const allowed = new Set(["tarball", "package", "output", "root", "source-date-epoch", "version", "tag", "repository", "commit", "npm-integrity", "tarball-sha256", "dry-run", "help"]);
  const options = argv[0] === "--" ? argv.slice(1) : argv;
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (!option?.startsWith("--")) throw new Error(HELP);
    const name = option.slice(2);
    if (!allowed.has(name)) throw new Error(`unsupported option --${name}`);
    if (name === "dry-run" || name === "help") {
      values[name] = true;
      continue;
    }
    const value = options[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`missing value for --${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

/** @param {string[]} argv */
export async function runReleaseArtifactCli(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const sourceDateEpoch = options["source-date-epoch"] ?? process.env.SOURCE_DATE_EPOCH;
  const outputDirectory = options.output ?? (options["dry-run"]
    ? await mkdtemp(path.join(tmpdir(), "cavi-docs-release-artifact-dry-run-"))
    : undefined);
  try {
    const result = await buildDocumentationReleaseArtifact({
      root: options.root ?? REPOSITORY_ROOT,
      tarball: options.tarball ?? options.package,
      outputDirectory: requiredString(outputDirectory, "--output"),
      sourceDateEpoch,
      release: {
        packageName: "@cavi-ai/api-client",
        version: options.version,
        tag: options.tag,
        npmIntegrity: options["npm-integrity"],
        tarballSha256: options["tarball-sha256"],
        repository: options.repository,
        commit: options.commit,
      },
    });
    process.stdout.write(`docs release artifact ${options["dry-run"] ? "validated" : "written"}: ${path.basename(result.artifactPath)} sha256=${result.sha256}\n`);
  } finally {
    if (options["dry-run"] && outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseArtifactCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

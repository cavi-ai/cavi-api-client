#!/usr/bin/env node
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadContracts } from "./contracts.mjs";
import { inspectRelease } from "./inspect-release.mjs";
import { renderDocumentation } from "./render.mjs";
import { containedPath } from "./paths.mjs";
import { DOCUMENTED_SOURCE_DATE_EPOCH, resolveDocumentationRelease } from "./types.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @param {string[]} argv */
function parseArguments(argv) {
  const allowedOptions = new Set(["tarball", "package", "output", "out", "output-root", "source-date-epoch", "root", "version", "tag", "repository", "commit", "npm-integrity", "tarball-sha256"]);
  /** @type {Record<string, string>} */
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith("--") || value === undefined) {
      throw new Error("usage: build.mjs --tarball <release.tgz> [--output <directory> | --output-root <directory>] [--source-date-epoch <seconds>]");
    }
    const name = option.slice(2);
    if (!allowedOptions.has(name)) throw new Error(`unsupported option --${name}`);
    values[name] = value;
  }
  // The tarball stays REQUIRED and is never read from the environment: a
  // production build must be told explicitly which artifact it documents, so it
  // cannot silently document whatever a stray env var points at. Callers pass
  // --package (see the docs:build script). Output path and reproducible-build
  // timestamp derive from the release pins (types.mjs) so they cannot drift.
  values.tarball ??= values.package;
  values["source-date-epoch"] ??= String(DOCUMENTED_SOURCE_DATE_EPOCH);
  for (const required of ["tarball", "source-date-epoch"]) {
    if (!values[required]) throw new Error(`missing required option --${required}`);
  }
  return values;
}

/** @param {string[]} argv */
export async function buildDocumentation(argv) {
  const options = parseArguments(argv);
  const release = resolveDocumentationRelease({
    version: options.version, tag: options.tag,
    tarball: options.tarball, npmIntegrity: options["npm-integrity"], tarballSha256: options["tarball-sha256"],
    repository: options.repository, commit: options.commit, outputRoot: options["output-root"],
  });
  if (options.root && path.resolve(options.root) !== REPOSITORY_ROOT) {
    throw new Error(`unsafe documentation repository root: ${path.resolve(options.root)}`);
  }
  const root = await realpath(REPOSITORY_ROOT);
  const outputDirectory = resolvePublicDocumentationOutput(root, options.output ?? options.out ?? release.outputDirectory, release);
  return buildDocumentationAt({ options, root, outputDirectory, allowedRoot: root, release });
}

/** @param {string} root @param {string} output @param {ReturnType<typeof resolveDocumentationRelease>} [release] */
export function resolvePublicDocumentationOutput(root, output, release = resolveDocumentationRelease()) {
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(resolvedRoot, output);
  const canonicalOutput = path.join(resolvedRoot, release.outputDirectory);
  if (resolvedOutput !== canonicalOutput) {
    throw new Error(`unsafe documentation output directory: ${resolvedOutput}`);
  }
  return resolvedOutput;
}

/**
 * Internal check/test capability. The caller must create `temporaryRoot` with
 * mkdtemp; generated output is fixed beneath that isolated root.
 * @param {string[]} argv
 * @param {string} temporaryRoot
 */
export async function buildDocumentationInTemporaryRoot(argv, temporaryRoot) {
  const options = parseArguments(argv);
  const output = options.output ?? options.out;
  if (output !== "generated") {
    throw new Error(`unsafe temporary documentation output: ${output}`);
  }
  const root = path.resolve(options.root ?? ".");
  const resolvedTemporaryRoot = await realpath(temporaryRoot);
  const outputDirectory = path.join(resolvedTemporaryRoot, "generated");
  const release = resolveDocumentationRelease({
    version: options.version, tag: options.tag, tarball: options.tarball,
    npmIntegrity: options["npm-integrity"], tarballSha256: options["tarball-sha256"],
    repository: options.repository, commit: options.commit, outputRoot: options["output-root"],
  });
  return buildDocumentationAt({ options, root, outputDirectory, allowedRoot: resolvedTemporaryRoot, release });
}

/** @param {{ options: Record<string, string>, root: string, outputDirectory: string, allowedRoot: string, release: ReturnType<typeof resolveDocumentationRelease> }} input */
async function buildDocumentationAt({ options, root, outputDirectory, allowedRoot, release }) {
  const manifest = await inspectRelease(path.resolve(options.tarball), release);
  const contracts = await loadContracts(root, manifest, release);
  const navigation = JSON.parse(
    await readFile(path.join(root, "docs/api-client/source/navigation.json"), "utf8"),
  );
  const rendered = renderDocumentation({
    manifest,
    contracts,
    navigation,
    curatedRoot: path.join(root, "docs/api-client/source"),
    sourceDateEpoch: options["source-date-epoch"],
    release,
  });
  const relativeOutput = path.relative(allowedRoot, outputDirectory);
  if (!relativeOutput || relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) {
    throw new Error(`unsafe documentation output directory: ${outputDirectory}`);
  }
  const resolvedParent = await realpath(path.dirname(outputDirectory));
  const relativeParent = path.relative(allowedRoot, resolvedParent);
  if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) {
    throw new Error(`unsafe documentation output directory: ${outputDirectory}`);
  }
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const resolvedOutputDirectory = await realpath(outputDirectory);
  for (const [relativePath, contents] of rendered) {
    const destination = containedPath(resolvedOutputDirectory, relativePath, "generated output path");
    await mkdir(path.dirname(destination), { recursive: true });
    const resolvedDestinationParent = await realpath(path.dirname(destination));
    const relativeDestinationParent = path.relative(resolvedOutputDirectory, resolvedDestinationParent);
    if (relativeDestinationParent.startsWith("..") || path.isAbsolute(relativeDestinationParent)) throw new Error(`generated output path: resolved destination escapes output root: ${relativePath}`);
    await writeFile(path.join(resolvedDestinationParent, path.basename(destination)), contents, "utf8");
  }
  return rendered;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildDocumentation(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

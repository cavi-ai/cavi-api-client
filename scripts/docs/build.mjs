#!/usr/bin/env node
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadContracts } from "./contracts.mjs";
import { inspectRelease } from "./inspect-release.mjs";
import { renderDocumentation } from "./render.mjs";
import { containedPath } from "./paths.mjs";
import { DOCUMENTED_OUTPUT_DIRECTORY, DOCUMENTED_SOURCE_DATE_EPOCH } from "./types.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @param {string[]} argv */
function parseArguments(argv) {
  const allowedOptions = new Set(["tarball", "package", "output", "out", "source-date-epoch", "root"]);
  /** @type {Record<string, string>} */
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith("--") || value === undefined) {
      throw new Error("usage: build.mjs --tarball <release.tgz> --output <directory> --source-date-epoch <seconds>");
    }
    const name = option.slice(2);
    if (!allowedOptions.has(name)) throw new Error(`unsupported option --${name}`);
    values[name] = value;
  }
  // The tarball stays REQUIRED: a production build must never guess the artifact
  // it documents. Output path and reproducible-build timestamp derive from the
  // release pins (types.mjs) so they cannot drift; explicit flags still win.
  values.tarball ??= values.package ?? process.env.CAVI_DOCS_PACKAGE_TGZ;
  values.output ??= values.out ?? DOCUMENTED_OUTPUT_DIRECTORY;
  values["source-date-epoch"] ??= process.env.SOURCE_DATE_EPOCH ?? String(DOCUMENTED_SOURCE_DATE_EPOCH);
  for (const required of ["tarball", "output", "source-date-epoch"]) {
    if (!values[required]) throw new Error(`missing required option --${required}`);
  }
  return values;
}

/** @param {string[]} argv */
export async function buildDocumentation(argv) {
  const options = parseArguments(argv);
  if (options.root && path.resolve(options.root) !== REPOSITORY_ROOT) {
    throw new Error(`unsafe documentation repository root: ${path.resolve(options.root)}`);
  }
  const root = await realpath(REPOSITORY_ROOT);
  const outputDirectory = resolvePublicDocumentationOutput(root, options.output);
  return buildDocumentationAt({ options, root, outputDirectory, allowedRoot: root });
}

/** @param {string} root @param {string} output */
export function resolvePublicDocumentationOutput(root, output) {
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(resolvedRoot, output);
  const canonicalOutput = path.join(resolvedRoot, DOCUMENTED_OUTPUT_DIRECTORY);
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
  if (options.output !== "generated") {
    throw new Error(`unsafe temporary documentation output: ${options.output}`);
  }
  const root = path.resolve(options.root ?? ".");
  const resolvedTemporaryRoot = await realpath(temporaryRoot);
  const outputDirectory = path.join(resolvedTemporaryRoot, "generated");
  return buildDocumentationAt({ options, root, outputDirectory, allowedRoot: resolvedTemporaryRoot });
}

/** @param {{ options: Record<string, string>, root: string, outputDirectory: string, allowedRoot: string }} input */
async function buildDocumentationAt({ options, root, outputDirectory, allowedRoot }) {
  const manifest = await inspectRelease(path.resolve(options.tarball));
  const contracts = await loadContracts(root, manifest);
  const navigation = JSON.parse(
    await readFile(path.join(root, "docs/api-client/source/navigation.json"), "utf8"),
  );
  const rendered = renderDocumentation({
    manifest,
    contracts,
    navigation,
    curatedRoot: path.join(root, "docs/api-client/source"),
    sourceDateEpoch: options["source-date-epoch"],
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

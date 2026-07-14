#!/usr/bin/env node
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadContracts } from "./contracts.mjs";
import { inspectRelease } from "./inspect-release.mjs";
import { renderDocumentation } from "./render.mjs";
import { containedPath } from "./paths.mjs";

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
  values.tarball ??= values.package;
  values.output ??= values.out;
  for (const required of ["tarball", "output", "source-date-epoch"]) {
    if (!values[required]) throw new Error(`missing required option --${required}`);
  }
  return values;
}

/** @param {string[]} argv */
export async function buildDocumentation(argv) {
  const options = parseArguments(argv);
  const root = path.resolve(options.root ?? ".");
  const outputDirectory = path.resolve(options.output);
  if (outputDirectory === path.parse(outputDirectory).root || outputDirectory === root) {
    throw new Error(`unsafe documentation output directory: ${outputDirectory}`);
  }
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
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const resolvedOutputDirectory = await realpath(outputDirectory);
  for (const [relativePath, contents] of rendered) {
    const destination = containedPath(resolvedOutputDirectory, relativePath, "generated output path");
    await mkdir(path.dirname(destination), { recursive: true });
    const resolvedParent = await realpath(path.dirname(destination));
    const relativeParent = path.relative(resolvedOutputDirectory, resolvedParent);
    if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) throw new Error(`generated output path: resolved destination escapes output root: ${relativePath}`);
    await writeFile(path.join(resolvedParent, path.basename(destination)), contents, "utf8");
  }
  return rendered;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildDocumentation(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadContracts } from "./contracts.mjs";
import { inspectRelease } from "./inspect-release.mjs";
import { renderDocumentation } from "./render.mjs";

/** @param {string[]} argv */
function parseArguments(argv) {
  /** @type {Record<string, string>} */
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith("--") || value === undefined) {
      throw new Error("usage: build.mjs --tarball <release.tgz> --output <directory> --source-date-epoch <seconds>");
    }
    values[option.slice(2)] = value;
  }
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
  for (const [relativePath, contents] of rendered) {
    const destination = path.join(outputDirectory, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents, "utf8");
  }
  return rendered;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildDocumentation(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

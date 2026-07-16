#!/usr/bin/env node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { buildDocumentationInTemporaryRoot } from "./build.mjs";
import { resolveStableTarball } from "./fetch-stable.mjs";
import { DOCUMENTED_OUTPUT_DIRECTORY, DOCUMENTED_SOURCE_DATE_EPOCH } from "./types.mjs";

function parseArguments(argv) {
  const allowedOptions = new Set(["package", "out", "source-date-epoch", "root"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith("--") || value === undefined) {
      throw new Error("usage: check.mjs [--package <release.tgz>] [--out <directory>] [--source-date-epoch <seconds>]");
    }
    const name = option.slice(2);
    if (!allowedOptions.has(name)) throw new Error(`unsupported option --${name}`);
    values[name] = value;
  }
  // Defaults come from the release pins (types.mjs) so a bare `pnpm docs:check`
  // works locally; an explicit flag or env var still wins (CI supplies both).
  values.package ??= resolveStableTarball();
  values.out ??= DOCUMENTED_OUTPUT_DIRECTORY;
  values["source-date-epoch"] ??= process.env.SOURCE_DATE_EPOCH ?? String(DOCUMENTED_SOURCE_DATE_EPOCH);
  values.root ??= ".";
  return values;
}

async function filePaths(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return filePaths(path.join(directory, entry.name), relative);
    return entry.isFile() ? [relative] : [];
  }));
  return nested.flat().sort();
}

async function validateRelativeMarkdownLinks(directory, files) {
  const fileSet = new Set(files);
  for (const relativePath of files.filter((file) => file.endsWith(".md"))) {
    const contents = await readFile(path.join(directory, relativePath), "utf8");
    for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const target = match[1].split("#", 1)[0].split("?", 1)[0];
      if (!target || /^(?:[a-z]+:|\/)/iu.test(target)) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), target));
      if (resolved.startsWith("../") || !fileSet.has(resolved)) {
        throw new Error(`invalid relative Markdown link: ${relativePath} -> ${target}`);
      }
    }
  }
}

async function validateContentIntegrity(directory, files) {
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  const hash = createHash("sha256");
  for (const relativePath of files.filter((file) => file !== "manifest.json").sort()) {
    hash.update(relativePath).update("\0").update(await readFile(path.join(directory, relativePath))).update("\0");
  }
  const observed = hash.digest("hex");
  if (manifest.contentSha256 !== observed) throw new Error(`generated content integrity mismatch: expected ${manifest.contentSha256}, observed ${observed}`);
}

export async function checkDocumentation(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "cavi-docs-check-"));
  const generated = path.join(temporaryRoot, "generated");
  const committed = path.resolve(options.out);
  try {
    await buildDocumentationInTemporaryRoot([
      "--package", path.resolve(options.package),
      "--out", "generated",
      "--source-date-epoch", options["source-date-epoch"],
      "--root", path.resolve(options.root),
    ], temporaryRoot);
    const [generatedFiles, committedFiles] = await Promise.all([
      filePaths(generated),
      filePaths(committed),
    ]);
    const allFiles = [...new Set([...generatedFiles, ...committedFiles])].sort();
    for (const relativePath of allFiles) {
      if (!generatedFiles.includes(relativePath) || !committedFiles.includes(relativePath)) {
        throw new Error(`generated documentation drift: ${relativePath}`);
      }
      const [actual, expected] = await Promise.all([
        readFile(path.join(generated, relativePath)),
        readFile(path.join(committed, relativePath)),
      ]);
      if (!actual.equals(expected)) throw new Error(`generated documentation drift: ${relativePath}`);
    }
    await validateRelativeMarkdownLinks(committed, committedFiles);
    await validateContentIntegrity(committed, committedFiles);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkDocumentation().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

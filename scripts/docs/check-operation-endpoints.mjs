#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OPERATIONS_DIR = path.join(ROOT, "docs/api-client/source/pages/operations");
const OWNER_PATHS_GLOBS = [
  "src/contracts/paths.ts",
  "src/extensions/cavi/contracts/paths.ts",
  "src/providers/claude/paths.ts",
  "src/providers/claude/managed-agents/paths.ts",
  "src/providers/codex/paths.ts",
  "src/providers/gemini/paths.ts",
  "src/providers/agy/paths.ts",
];

/** Extract owner-checkable static path prefixes from a page's `**HTTP**` lines. */
export function extractHttpPaths(markdown) {
  const paths = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("**HTTP**")) continue;
    for (const match of line.matchAll(/`([^`]+)`/gu)) {
      const token = match[1];
      const found = token.match(/\s(\/[^\s?]+)/u) ?? token.match(/^(\/[^\s?]+)/u);
      if (!found) continue; // skips "n/a (…)" and RPC prose
      const segments = found[1].split("/").filter(Boolean);
      const staticSegments = [];
      for (const segment of segments) {
        if (segment.startsWith(":")) break;
        staticSegments.push(segment);
      }
      if (staticSegments.length) paths.push(`/${staticSegments.join("/")}`);
    }
  }
  return [...new Set(paths)];
}

/**
 * True when a documented static path prefix corresponds to a source literal.
 * Version-prefixed API paths (e.g. Gemini `/v1beta/models/...`) are assembled in
 * source from a version constant plus the remainder, so the full prefix is not a
 * contiguous literal — accept those when the version-stripped remainder is.
 */
export function isKnownPath(candidate, corpus) {
  if (corpus.includes(candidate)) return true;
  const segments = candidate.split("/").filter(Boolean);
  if (segments.length > 1 && /^v\d/u.test(segments[0])) {
    return corpus.includes(`/${segments.slice(1).join("/")}`);
  }
  return false;
}

/** Paths with no corresponding literal (direct or version-stripped) in the corpus. */
export function findOrphanPaths(paths, corpus) {
  return paths.filter((candidate) => !isKnownPath(candidate, corpus));
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(full);
      return entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
    }),
  );
  return nested.flat();
}

async function main() {
  const corpus = (
    await Promise.all(OWNER_PATHS_GLOBS.map((rel) => readFile(path.join(ROOT, rel), "utf8")))
  ).join("\n");
  const files = await markdownFiles(OPERATIONS_DIR);
  let orphanTotal = 0;
  for (const file of files) {
    const orphans = findOrphanPaths(extractHttpPaths(await readFile(file, "utf8")), corpus);
    if (orphans.length) {
      orphanTotal += orphans.length;
      console.error(`${path.relative(ROOT, file)}: unknown HTTP paths -> ${orphans.join(", ")}`);
    }
  }
  if (orphanTotal) {
    console.error(`\n${orphanTotal} documented HTTP path(s) not found in any owner paths.ts.`);
    process.exit(1);
  }
  console.log(`check-operation-endpoints: all documented HTTP paths resolve (${files.length} pages).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

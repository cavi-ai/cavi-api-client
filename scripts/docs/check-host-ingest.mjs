#!/usr/bin/env node
/**
 * Validate an unpacked docs tree or a docs release archive against the host
 * consumer contract (manifest identity + contentSha256).
 *
 * Usage:
 *   node scripts/docs/check-host-ingest.mjs --dir docs/api-client/v0.15.0
 *   node scripts/docs/check-host-ingest.mjs --archive path/to/cavi-api-client-docs-v0.15.0.tar.gz
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("usage: check-host-ingest.mjs (--dir <path> | --archive <tgz>) [--expect-version <semver>]");
    }
    out[key.slice(2)] = value;
  }
  if (!out.dir && !out.archive) throw new Error("provide --dir or --archive");
  if (out.dir && out.archive) throw new Error("provide only one of --dir or --archive");
  return out;
}

async function listFiles(root) {
  const files = [];
  async function walk(relative) {
    const absolute = path.join(root, relative);
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) files.push(next.split(path.sep).join("/"));
    }
  }
  await walk("");
  return files.sort((a, b) => a.localeCompare(b));
}

async function contentDigest(root) {
  const hash = createHash("sha256");
  for (const filePath of await listFiles(root)) {
    if (filePath === "manifest.json") continue;
    const bytes = await readFile(path.join(root, filePath));
    hash.update(filePath).update("\0").update(bytes).update("\0");
  }
  return hash.digest("hex");
}

async function unpackArchive(archive) {
  const scratch = await mkdtemp(path.join(tmpdir(), "docs-host-ingest-"));
  execFileSync("tar", ["-xzf", archive, "-C", scratch], { stdio: ["ignore", "ignore", "inherit"] });
  const top = await readdir(scratch, { withFileTypes: true });
  for (const entry of top) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(scratch, entry.name);
    try {
      await stat(path.join(candidate, "manifest.json"));
      return { root: candidate, cleanup: scratch };
    } catch {
      // continue
    }
  }
  await stat(path.join(scratch, "manifest.json"));
  return { root: scratch, cleanup: scratch };
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`invalid ${label}`);
  return value;
}

async function validateDocsRoot(docsRoot, expectVersion) {
  const manifest = JSON.parse(await readFile(path.join(docsRoot, "manifest.json"), "utf8"));
  const navigation = JSON.parse(await readFile(path.join(docsRoot, "navigation.json"), "utf8"));

  if (manifest.package !== "@cavi-ai/api-client") {
    throw new Error(`manifest.package: expected @cavi-ai/api-client; observed ${manifest.package}`);
  }
  const version = requireString(manifest.version, "manifest.version");
  if (expectVersion && version !== expectVersion) {
    throw new Error(`manifest.version: expected ${expectVersion}; observed ${version}`);
  }
  if (navigation.version !== version) {
    throw new Error(`navigation.version drift: manifest ${version}; navigation ${navigation.version}`);
  }
  requireString(manifest.sourceTarballSha256, "manifest.sourceTarballSha256");
  if (!/^[a-f0-9]{64}$/u.test(manifest.sourceTarballSha256)) {
    throw new Error("manifest.sourceTarballSha256 must be 64 hex chars");
  }
  const observedContent = await contentDigest(docsRoot);
  if (observedContent !== manifest.contentSha256) {
    throw new Error(
      `contentSha256 mismatch: manifest ${manifest.contentSha256}; observed ${observedContent}`,
    );
  }
  if (!Array.isArray(navigation.sections) || navigation.sections.length === 0) {
    throw new Error("navigation.sections must be a non-empty array");
  }
  for (const section of navigation.sections) {
    const title = section?.title ?? "(missing title)";
    const pages = section?.pages;
    if (pages !== undefined && (!Array.isArray(pages) || pages.length === 0)) {
      throw new Error(`navigation section "${title}" has an empty pages array`);
    }
  }
  return { version, packageName: manifest.package, contentSha256: observedContent };
}

const args = parseArgs(process.argv.slice(2));
let cleanup;
try {
  let docsRoot;
  if (args.archive) {
    const unpacked = await unpackArchive(path.resolve(args.archive));
    docsRoot = unpacked.root;
    cleanup = unpacked.cleanup;
  } else {
    docsRoot = path.resolve(args.dir);
  }
  const result = await validateDocsRoot(docsRoot, args["expect-version"]);
  process.stdout.write(
    `docs:host-ingest-check — ok ${result.packageName}@${result.version} contentSha256=${result.contentSha256}\n`,
  );
} finally {
  if (cleanup) await rm(cleanup, { recursive: true, force: true });
}

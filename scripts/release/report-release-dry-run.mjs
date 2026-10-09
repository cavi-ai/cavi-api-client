#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { formatDocumentationReleaseDryRunReport } from "./release-artifact.mjs";

const HELP = "usage: pnpm run release:dry-run-report -- --artifact <docs.tar.gz> --manifest <cavi-release.json> --envelope <release-envelope.json>\n";

function parseArguments(argv) {
  const options = argv[0] === "--" ? argv.slice(1) : argv;
  const values = {};
  const allowed = new Set(["artifact", "manifest", "envelope", "help"]);
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (!option?.startsWith("--")) throw new Error(HELP.trim());
    const name = option.slice(2);
    if (!allowed.has(name)) throw new Error(`unsupported option --${name}`);
    if (name === "help") {
      values.help = true;
      continue;
    }
    const value = options[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for --${name}`);
    }
    values[name] = value;
    index += 1;
  }
  return values;
}

function required(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`missing required ${label}`);
  return value;
}

export async function runReleaseDryRunReportCli(
  argv = process.argv.slice(2),
  dependencies = {},
) {
  const options = parseArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.help) {
    stdout.write(HELP);
    return;
  }
  const artifact = path.resolve(required(options.artifact, "--artifact"));
  const manifestPath = path.resolve(required(options.manifest, "--manifest"));
  const envelopePath = path.resolve(required(options.envelope, "--envelope"));
  const [archive, manifestText, envelopeText] = await Promise.all([
    readFile(artifact),
    readFile(manifestPath, "utf8"),
    readFile(envelopePath, "utf8"),
  ]);
  // Inspect the captured bytes used for the digest, rather than reopening a path.
  const tarOptions = { input: archive, encoding: "utf8" };
  const members = execFileSync("tar", ["-tzf", "-"], tarOptions).split("\n").filter(Boolean);
  const manifest = JSON.parse(manifestText);
  const report = formatDocumentationReleaseDryRunReport({
    artifactName: path.basename(artifact),
    artifactSha256: createHash("sha256").update(archive).digest("hex"),
    members,
    manifest,
    envelope: JSON.parse(envelopeText),
  });
  let embeddedManifest;
  try {
    embeddedManifest = JSON.parse(execFileSync("tar", ["-xOzf", "-", "cavi-release.json"], tarOptions));
  } catch {
    throw new Error("invalid archive release manifest");
  }
  if (!isDeepStrictEqual(manifest, embeddedManifest)) {
    throw new Error("manifest does not match archive provenance");
  }
  stdout.write(report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseDryRunReportCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const CANONICAL_REPOSITORY = "cavi-ai/cavi-api-client";
const STABLE_EXACT_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const COMMIT_SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

/** @param {unknown} value @param {string} label */
function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`missing required ${label}`);
  return value;
}

/**
 * @param {{version: string, tag: string, repository: string, commit: string, artifactSha256: string}} input
 */
export function createReleaseEnvelope(input) {
  const version = requiredString(input.version, "version");
  if (!STABLE_EXACT_VERSION.test(version)) {
    throw new Error(`release version must be a stable exact version: ${version}`);
  }
  const tag = requiredString(input.tag, "tag");
  if (tag !== `v${version}`) throw new Error(`release tag ${tag} does not match version ${version}`);
  const repository = requiredString(input.repository, "repository");
  if (repository !== CANONICAL_REPOSITORY) throw new Error(`release repository must be ${CANONICAL_REPOSITORY}`);
  const commit = requiredString(input.commit, "commit");
  if (!COMMIT_SHA.test(commit)) throw new Error("release commit must be a lowercase 40-character SHA");
  const artifactSha256 = requiredString(input.artifactSha256, "artifact SHA-256");
  if (!SHA256.test(artifactSha256)) throw new Error("artifact SHA-256 must be 64 lowercase hexadecimal characters");

  const artifactName = `cavi-api-client-docs-${tag}.tar.gz`;
  return {
    schemaVersion: 1,
    slug: "api-client",
    kind: "package-docs",
    version,
    tag,
    repository,
    commit,
    artifact: {
      url: `https://github.com/${repository}/releases/download/${tag}/${artifactName}`,
      sha256: artifactSha256,
      format: "tar.gz",
    },
  };
}

const HELP = "usage: pnpm run docs:release-envelope -- --version <stable-semver> --tag <vstable-semver> --repository cavi-ai/cavi-api-client --commit <40-char-sha> --artifact-sha256 <sha256>\n";

/** @param {string[]} argv */
function parseArguments(argv) {
  const options = argv[0] === "--" ? argv.slice(1) : argv;
  const values = {};
  const allowed = new Set(["version", "tag", "repository", "commit", "artifact-sha256", "help"]);
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
    if (value === undefined || value.startsWith("--")) throw new Error(`missing value for --${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

/**
 * @param {string[]} [argv]
 * @param {{stdout?: Pick<NodeJS.WriteStream, "write">}} [dependencies]
 */
export async function runCreateReleaseEnvelopeCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.help) {
    stdout.write(HELP);
    return;
  }
  const envelope = createReleaseEnvelope({
    version: options.version,
    tag: options.tag,
    repository: options.repository,
    commit: options.commit,
    artifactSha256: options["artifact-sha256"],
  });
  stdout.write(`${JSON.stringify(envelope)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCreateReleaseEnvelopeCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

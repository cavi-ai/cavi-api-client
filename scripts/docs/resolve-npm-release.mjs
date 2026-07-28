#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/";
const DEFAULT_PACKAGE_NAME = "@cavi-ai/api-client";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const STABLE_EXACT_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const COMMIT_SHA = /^[a-f0-9]{40}$/u;
const SHA512_INTEGRITY = /^sha512-(?<digest>[A-Za-z0-9+/]{86}==)$/u;
const PACKAGE_NAME = /^@(?<scope>[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)\/(?<name>[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)$/u;

/** @param {unknown} value @param {string} label */
function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`missing required ${label}`);
  return value;
}

/** @param {string} version */
function stableVersion(version) {
  if (!STABLE_EXACT_VERSION.test(version)) {
    throw new Error(`release version must be a stable exact version: ${version}`);
  }
  return version;
}

/** @param {string} packageName @param {string} version */
function canonicalTarballUrl(packageName, version) {
  const match = PACKAGE_NAME.exec(packageName);
  if (!match?.groups) throw new Error(`invalid scoped npm package name: ${packageName}`);
  return `${NPM_REGISTRY_URL}${packageName}/-/${match.groups.name}-${version}.tgz`;
}

/** @param {Response} response @param {string} description */
function requireSuccessfulResponse(response, description) {
  if (!response?.ok) {
    throw new Error(`${description} failed with HTTP ${response?.status ?? "unknown"}`);
  }
  return response;
}

function requestTimeout(value) {
  const timeoutMs = value ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("npm request timeout must be a positive integer");
  }
  return timeoutMs;
}

async function fetchResponseWithTimeout({
  fetchImpl,
  url,
  headers,
  description,
  timeoutMs,
  timeoutSignalFactory,
  read,
}) {
  const signal = timeoutSignalFactory(timeoutMs);
  if (!signal || typeof signal !== "object" || typeof signal.aborted !== "boolean") {
    throw new Error("timeout signal factory must return an AbortSignal");
  }
  try {
    const response = requireSuccessfulResponse(
      await fetchImpl(url, { headers, signal }),
      description,
    );
    return await read(response);
  } catch (error) {
    if (signal.aborted) {
      throw new Error(`${description} timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw error;
  }
}

/**
 * Resolve and verify the exact npm artifact for a stable release.
 * Network access is supplied by `fetchImpl`, allowing offline tests and callers.
 *
 * @param {{packageName: string, version: string, tag: string, commit: string, outputFile: string, fetchImpl?: typeof fetch, requestTimeoutMs?: number, timeoutSignalFactory?: (timeoutMs:number) => AbortSignal}} input
 */
export async function resolveNpmRelease(input) {
  const packageName = requiredString(input.packageName, "package name");
  const version = stableVersion(requiredString(input.version, "version"));
  const tag = requiredString(input.tag, "tag");
  const commit = requiredString(input.commit, "commit");
  const outputFile = path.resolve(requiredString(input.outputFile, "output file"));
  if (tag !== `v${version}`) throw new Error(`release tag ${tag} does not match version ${version}`);
  if (!COMMIT_SHA.test(commit)) throw new Error("release commit must be a lowercase 40-character SHA");

  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  const timeoutMs = requestTimeout(input.requestTimeoutMs);
  const timeoutSignalFactory = input.timeoutSignalFactory ??
    ((milliseconds) => AbortSignal.timeout(milliseconds));
  if (typeof timeoutSignalFactory !== "function") {
    throw new Error("timeout signal factory is required");
  }
  const metadataUrl = new URL(`${encodeURIComponent(packageName)}/${version}`, NPM_REGISTRY_URL).href;
  const metadata = await fetchResponseWithTimeout({
    fetchImpl,
    url: metadataUrl,
    headers: { accept: "application/json" },
    description: "npm metadata request",
    timeoutMs,
    timeoutSignalFactory,
    read: (response) => response.json(),
  });
  if (!metadata || typeof metadata !== "object") throw new Error("npm metadata must be an object");
  if (metadata.name !== packageName) {
    throw new Error(`npm metadata package mismatch: expected ${packageName}, observed ${String(metadata.name)}`);
  }
  if (metadata.version !== version) {
    throw new Error(`npm metadata version mismatch: expected ${version}, observed ${String(metadata.version)}`);
  }
  if (metadata.gitHead !== commit) {
    throw new Error(`npm metadata gitHead does not match release commit ${commit}`);
  }
  if (!metadata.dist || typeof metadata.dist !== "object") throw new Error("npm metadata dist is required");
  const integrity = requiredString(metadata.dist.integrity, "npm dist.integrity");
  const integrityMatch = SHA512_INTEGRITY.exec(integrity);
  if (!integrityMatch?.groups) throw new Error("npm dist.integrity must be a sha512 SRI digest");
  const tarballUrl = requiredString(metadata.dist.tarball, "npm dist.tarball");
  const expectedTarballUrl = canonicalTarballUrl(packageName, version);
  if (tarballUrl !== expectedTarballUrl) {
    throw new Error(`npm metadata must use the canonical npm tarball URL: expected ${expectedTarballUrl}`);
  }

  const tarball = await fetchResponseWithTimeout({
    fetchImpl,
    url: tarballUrl,
    headers: { accept: "application/octet-stream" },
    description: "npm tarball request",
    timeoutMs,
    timeoutSignalFactory,
    read: async (response) => Buffer.from(await response.arrayBuffer()),
  });
  const observedIntegrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
  if (observedIntegrity !== integrity) throw new Error("npm tarball integrity mismatch");
  const tarballSha256 = createHash("sha256").update(tarball).digest("hex");

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, tarball, { mode: 0o600 });
  return { version, tag, metadataUrl, tarballUrl, integrity, tarballSha256 };
}

const HELP = "usage: pnpm run docs:resolve-npm-release -- --version <stable-semver> --tag <vstable-semver> --commit <40-char-sha> --output <release.tgz>\n";

/** @param {string[]} argv */
function parseArguments(argv) {
  const options = argv[0] === "--" ? argv.slice(1) : argv;
  const values = {};
  const allowed = new Set(["version", "tag", "commit", "output", "help"]);
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
 * @param {{fetchImpl?: typeof fetch, stdout?: Pick<NodeJS.WriteStream, "write">}} [dependencies]
 */
export async function runResolveNpmReleaseCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.help) {
    stdout.write(HELP);
    return;
  }
  const release = await resolveNpmRelease({
    packageName: DEFAULT_PACKAGE_NAME,
    version: options.version,
    tag: options.tag,
    commit: options.commit,
    outputFile: options.output,
    fetchImpl: dependencies.fetchImpl,
  });
  stdout.write(`${JSON.stringify(release)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runResolveNpmReleaseCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

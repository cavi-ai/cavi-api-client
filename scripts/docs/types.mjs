/** @typedef {"supported" | "unsupported" | "conditional" | "unknown"} CapabilityState */

/**
 * @typedef {object} ReleaseExport
 * @property {string} subpath
 * @property {"declaration" | "asset"} kind
 * @property {string} [types]
 * @property {string} [target]
 */

/**
 * @typedef {object} ReleaseSymbol
 * @property {string} subpath
 * @property {string} name
 * @property {string} kind
 * @property {string} signature
 */

/**
 * @typedef {object} ReleaseManifest
 * @property {string} package
 * @property {string} version
 * @property {string} tag
 * @property {string} commit
 * @property {string} sha256
 * @property {ReleaseExport[]} exports
 * @property {ReleaseSymbol[]} symbols
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageJson = require(path.join(PACKAGE_ROOT, "package.json"));

/**
 * Canonical package identity comes from package.json. Commit + tarball digest
 * come from the checked-in source manifest for that version so verify stays
 * hermetic. `docs-pins` / drift tests fail if these disagree.
 */
export const DOCUMENTED_PACKAGE = packageJson.name;
export const DOCUMENTED_VERSION = packageJson.version;
export const DOCUMENTED_TAG = `v${DOCUMENTED_VERSION}`;
export const DOCUMENTED_REPOSITORY = "cavi-ai/cavi-api-client";
/** Canonical output directory for the generated reference, relative to the repo root. */
export const DOCUMENTED_OUTPUT_DIRECTORY = `docs/api-client/${DOCUMENTED_TAG}`;

const SOURCE_MANIFEST_PATH = path.join(
  PACKAGE_ROOT,
  "docs/api-client/source/releases",
  `${DOCUMENTED_VERSION}-manifest.json`,
);

function loadSourceManifestIdentity() {
  if (!existsSync(SOURCE_MANIFEST_PATH)) {
    throw new Error(
      `missing source release manifest for package.json version ${DOCUMENTED_VERSION}: ${path.relative(PACKAGE_ROOT, SOURCE_MANIFEST_PATH)}`,
    );
  }
  const manifest = JSON.parse(readFileSync(SOURCE_MANIFEST_PATH, "utf8"));
  if (manifest.package !== DOCUMENTED_PACKAGE) {
    throw new Error(
      `source manifest package mismatch: expected ${DOCUMENTED_PACKAGE}; observed ${manifest.package}`,
    );
  }
  if (manifest.version !== DOCUMENTED_VERSION) {
    throw new Error(
      `source manifest version mismatch: expected ${DOCUMENTED_VERSION}; observed ${manifest.version}`,
    );
  }
  if (manifest.tag !== DOCUMENTED_TAG) {
    throw new Error(
      `source manifest tag mismatch: expected ${DOCUMENTED_TAG}; observed ${manifest.tag}`,
    );
  }
  if (typeof manifest.commit !== "string" || !/^[0-9a-f]{40}$/u.test(manifest.commit)) {
    throw new Error(`source manifest commit invalid: ${String(manifest.commit)}`);
  }
  if (typeof manifest.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(manifest.sha256)) {
    throw new Error(`source manifest sha256 invalid: ${String(manifest.sha256)}`);
  }
  const sourceDateEpoch = Number(manifest.sourceDateEpoch);
  if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch <= 0) {
    throw new Error(`source manifest sourceDateEpoch invalid: ${String(manifest.sourceDateEpoch)}`);
  }
  return {
    commit: manifest.commit,
    sha256: manifest.sha256,
    sourceDateEpoch,
  };
}

const identity = loadSourceManifestIdentity();
export const DOCUMENTED_COMMIT = identity.commit;
export const APPROVED_RELEASE_SHA256 = identity.sha256;
/**
 * Reproducible-build timestamp. Prefer an explicit sourceDateEpoch on the
 * source manifest; otherwise fall back to the committer time of DOCUMENTED_COMMIT
 * when git is available at load time is intentionally avoided so shallow clones
 * and packed consumers stay hermetic. Pin it on the source manifest instead.
 */
if (!Number.isSafeInteger(identity.sourceDateEpoch) || identity.sourceDateEpoch <= 0) {
  throw new Error(
    `source manifest sourceDateEpoch missing/invalid for ${DOCUMENTED_VERSION}; set it to the committer time of ${DOCUMENTED_TAG}`,
  );
}
export const DOCUMENTED_SOURCE_DATE_EPOCH = identity.sourceDateEpoch;

const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

/**
 * Resolve the exact npm release documented by an operation. The checked-in
 * stable pins remain the default; supplying any release identity field opts
 * into release mode, where every identity field must be explicit.
 *
 * @param {Partial<{packageName:string, version:string, tag:string, tarball:string, npmIntegrity:string, tarballSha256:string, repository:string, commit:string, outputRoot:string}>} [options]
 */
export function resolveDocumentationRelease(options = {}) {
  const stable = {
    packageName: DOCUMENTED_PACKAGE,
    version: DOCUMENTED_VERSION,
    tag: DOCUMENTED_TAG,
    tarball: undefined,
    npmIntegrity: undefined,
    tarballSha256: APPROVED_RELEASE_SHA256,
    repository: DOCUMENTED_REPOSITORY,
    commit: DOCUMENTED_COMMIT,
    outputRoot: "docs/api-client",
    sourceDateEpoch: DOCUMENTED_SOURCE_DATE_EPOCH,
  };
  const identityFields = ["packageName", "version", "tag", "npmIntegrity", "tarballSha256", "repository", "commit"];
  const requiredExplicitFields = ["version", "tag", "npmIntegrity", "tarballSha256", "repository", "commit", "tarball"];
  const releaseMode = identityFields.some((field) => options[field] !== undefined);
  const release = {
    ...stable,
    ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
  };

  if (releaseMode) {
    for (const field of requiredExplicitFields) {
      if (typeof options[field] !== "string" || !options[field].trim()) {
        throw new Error(`missing required release option ${field}`);
      }
    }
  }
  if (typeof release.packageName !== "string" || !release.packageName.startsWith("@")) {
    throw new Error("invalid package name");
  }
  if (!SEMVER.test(release.version)) throw new Error("invalid release version");
  if (release.tag !== `v${release.version}`) throw new Error(`invalid release tag: expected v${release.version}`);
  if (!SHA256.test(release.tarballSha256)) throw new Error("invalid tarball sha256");
  if (!COMMIT.test(release.commit)) throw new Error("invalid release commit");
  if (!REPOSITORY.test(release.repository)) throw new Error("invalid release repository");
  if (release.npmIntegrity !== undefined) {
    const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/u.exec(release.npmIntegrity);
    if (!match || Buffer.from(match[1], "base64").length !== 64) throw new Error("invalid npm integrity");
  }
  if (typeof release.outputRoot !== "string" || !release.outputRoot.trim()) {
    throw new Error("invalid documentation output root");
  }
  const outputRoot = release.outputRoot.replace(/\\/gu, "/").replace(/\/$/u, "");
  return Object.freeze({
    ...release,
    isExplicitRelease: releaseMode,
    outputRoot,
    outputDirectory: `${outputRoot}/${release.tag}`,
    sourceManifestPath: `docs/api-client/source/releases/${release.version}-manifest.json`,
  });
}
export const CAPABILITY_STATES = Object.freeze([
  "supported",
  "unsupported",
  "conditional",
  "unknown",
]);

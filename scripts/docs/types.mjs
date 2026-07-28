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

/**
 * The documented release — the last PUBLISHED version, whose real `.d.ts` the
 * documentation gates type-check the published examples against.
 *
 * THESE PINS MOVE TOGETHER, ONCE PER RELEASE, AND ONLY HERE. Everything else
 * (build output path, check output path, stable-typecheck includes, the `files`
 * allowlist, and both workflows) derives from them. `docs-pins.test.ts` fails
 * the build if they drift out of sync.
 *
 * To bump after publishing X.Y.Z:
 *   DOCUMENTED_VERSION            X.Y.Z
 *   DOCUMENTED_TAG                vX.Y.Z
 *   DOCUMENTED_COMMIT             git rev-parse "vX.Y.Z^{}"
 *   APPROVED_RELEASE_SHA256       shasum -a 256 "$(npm pack @cavi-ai/api-client@X.Y.Z)"
 *   DOCUMENTED_SOURCE_DATE_EPOCH  git log -1 --format=%ct "vX.Y.Z^{}"
 */
export const DOCUMENTED_PACKAGE = "@cavi-ai/api-client";
export const DOCUMENTED_VERSION = "0.14.0";
export const DOCUMENTED_TAG = "v0.14.0";
export const DOCUMENTED_COMMIT = "372269713d5140092d489299bbceffc65b92a8bb";
export const APPROVED_RELEASE_SHA256 = "8ead1d95c5973a94822536cd922bb8282a4509d339f459384ef494135a5f4adb";
/**
 * Reproducible-build timestamp: the committer time of DOCUMENTED_COMMIT. Pinned
 * rather than read from git so the build stays reproducible in shallow clones
 * and from the published tarball, where the commit may be absent.
 */
export const DOCUMENTED_SOURCE_DATE_EPOCH = 1784861423;
/** Canonical output directory for the generated reference, relative to the repo root. */
export const DOCUMENTED_OUTPUT_DIRECTORY = `docs/api-client/${DOCUMENTED_TAG}`;

export const DOCUMENTED_REPOSITORY = "cavi-ai/cavi-api-client";

const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
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

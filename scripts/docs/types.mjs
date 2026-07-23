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
export const DOCUMENTED_VERSION = "0.13.0";
export const DOCUMENTED_TAG = "v0.13.0";
export const DOCUMENTED_COMMIT = "453ed07f00dcc94e768ad5546569ec53a3ac60cf";
export const APPROVED_RELEASE_SHA256 = "d5edf6fdedb485faa74bb1432c4b13b14b912e9519a11b7f1867522cc0e9c0d2";
/**
 * Reproducible-build timestamp: the committer time of DOCUMENTED_COMMIT. Pinned
 * rather than read from git so the build stays reproducible in shallow clones
 * and from the published tarball, where the commit may be absent.
 */
export const DOCUMENTED_SOURCE_DATE_EPOCH = 1784823582;
/** Canonical output directory for the generated reference, relative to the repo root. */
export const DOCUMENTED_OUTPUT_DIRECTORY = `docs/api-client/${DOCUMENTED_TAG}`;
export const CAPABILITY_STATES = Object.freeze([
  "supported",
  "unsupported",
  "conditional",
  "unknown",
]);

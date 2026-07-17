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
export const DOCUMENTED_VERSION = "0.12.0";
export const DOCUMENTED_TAG = "v0.12.0";
export const DOCUMENTED_COMMIT = "48635473128501743385230deee6f88e1983a148";
export const APPROVED_RELEASE_SHA256 = "3327537cf74089970251c1983fa786f95c843fb061f0411fe3ee651939d1638e";
/**
 * Reproducible-build timestamp: the committer time of DOCUMENTED_COMMIT. Pinned
 * rather than read from git so the build stays reproducible in shallow clones
 * and from the published tarball, where the commit may be absent.
 */
export const DOCUMENTED_SOURCE_DATE_EPOCH = 1784143728;
/** Canonical output directory for the generated reference, relative to the repo root. */
export const DOCUMENTED_OUTPUT_DIRECTORY = `docs/api-client/${DOCUMENTED_TAG}`;
export const CAPABILITY_STATES = Object.freeze([
  "supported",
  "unsupported",
  "conditional",
  "unknown",
]);

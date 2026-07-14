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

export const DOCUMENTED_PACKAGE = "@cavi-ai/api-client";
export const DOCUMENTED_VERSION = "0.11.0";
export const DOCUMENTED_TAG = "v0.11.0";
export const DOCUMENTED_COMMIT = "48adfa6ba7c3d5e8ffee0a6cf2572574ca630fa0";
export const APPROVED_RELEASE_SHA256 = "3379cd47b4890d0e00f5949583f90a83367705878b16141e825f66ef5d8819e5";
export const CAPABILITY_STATES = Object.freeze([
  "supported",
  "unsupported",
  "conditional",
  "unknown",
]);

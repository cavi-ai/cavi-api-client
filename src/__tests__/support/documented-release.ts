import {
  DOCUMENTED_PACKAGE,
  DOCUMENTED_VERSION,
} from "../../../scripts/docs/types.mjs";

/**
 * Test-side derivations of the documentation release pins.
 *
 * The pins live once, in `scripts/docs/types.mjs`. Tests derive from them rather
 * than restating them, so a release bump is a one-file edit and can only fail on
 * artifacts that genuinely need regenerating — never on a stale copy of a version
 * string. See `docs-pins.test.ts` for the pins' own consistency checks.
 */

/** Escape a value for literal use inside a RegExp source. */
export function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** The committed release manifest snapshot for the documented version. */
export const DOCUMENTED_RELEASE_MANIFEST_PATH =
  `docs/api-client/source/releases/${DOCUMENTED_VERSION}-manifest.json`;

/** `@scope/name@version` identity of the documented release. */
export const DOCUMENTED_RELEASE_SPECIFIER = `${DOCUMENTED_PACKAGE}@${DOCUMENTED_VERSION}`;

/**
 * A version that is deliberately NOT the documented one, derived by bumping the
 * documented patch. Negative cases ("rejects release version drift") need a value
 * the gates must reject; deriving it guarantees it can never accidentally become
 * equal to DOCUMENTED_VERSION after a bump.
 */
export const UNDOCUMENTED_VERSION = ((): string => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(DOCUMENTED_VERSION);
  if (!match) throw new Error(`DOCUMENTED_VERSION is not semver: ${DOCUMENTED_VERSION}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
})();

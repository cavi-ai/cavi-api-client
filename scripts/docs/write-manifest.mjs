#!/usr/bin/env node
/**
 * Generate the release manifest for the documented release.
 *
 * `docs/api-client/source/releases/<version>-manifest.json` is the declaration of
 * what a published release actually exports — it drives the generated reference
 * navigation and every contract's `evidence` path. It had no generator: the file
 * was hand-maintained, which is why bumping the documented release was a manual
 * ritual that release 0.12.0 skipped entirely.
 *
 * `inspectRelease` already extracts precisely this shape from a packed artifact
 * (and refuses one whose digest is not the pinned APPROVED_RELEASE_SHA256), so
 * this is a thin writer over it rather than a second source of truth.
 *
 * Usage: provision the artifact first (`pnpm run docs:stable`), then
 * `pnpm run docs:manifest`.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveStableTarball } from "./fetch-stable.mjs";
import { inspectRelease } from "./inspect-release.mjs";
import { DOCUMENTED_VERSION } from "./types.mjs";

const tarball = resolveStableTarball(["CAVI_DOCS_PACKAGE_TGZ", "CAVI_API_CLIENT_STABLE_TARBALL"]);
const manifest = await inspectRelease(tarball);

// inspectRelease reads version + sha256 from the artifact itself while tag and
// commit come from the pins, so a mismatch here means the pins and the artifact
// describe different releases — fail rather than write a manifest that lies.
if (manifest.version !== DOCUMENTED_VERSION) {
  throw new Error(
    `artifact/pin mismatch: ${tarball} contains ${manifest.package}@${manifest.version}, ` +
      `but DOCUMENTED_VERSION is ${DOCUMENTED_VERSION}`,
  );
}

const target = path.resolve(
  `docs/api-client/source/releases/${DOCUMENTED_VERSION}-manifest.json`,
);
await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${target}\n`);

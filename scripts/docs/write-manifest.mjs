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
import { resolveDocumentationRelease } from "./types.mjs";

function parseArguments(argv) {
  const values = {};
  const allowed = new Set(["tarball", "version", "tag", "repository", "commit", "npm-integrity", "tarball-sha256"]);
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith("--") || value === undefined) throw new Error("usage: write-manifest.mjs [--tarball <release.tgz> --version <semver> --tag v<semver> --repository owner/repo --commit <sha> --npm-integrity <sha512-base64> --tarball-sha256 <hex>]");
    const name = option.slice(2);
    if (!allowed.has(name)) throw new Error(`unsupported option --${name}`);
    values[name] = value;
  }
  values.tarball ??= resolveStableTarball(["CAVI_DOCS_PACKAGE_TGZ", "CAVI_API_CLIENT_STABLE_TARBALL"]);
  return values;
}

const options = parseArguments(process.argv.slice(2));
const release = resolveDocumentationRelease({
  version: options.version, tag: options.tag, tarball: options.tarball,
  npmIntegrity: options["npm-integrity"], tarballSha256: options["tarball-sha256"],
  repository: options.repository, commit: options.commit,
});
const tarball = release.tarball;
const manifest = await inspectRelease(tarball, release);

// inspectRelease reads version + sha256 from the artifact itself while tag and
// commit come from the pins, so a mismatch here means the pins and the artifact
// describe different releases — fail rather than write a manifest that lies.
if (manifest.version !== release.version) {
  throw new Error(
    `artifact/pin mismatch: ${tarball} contains ${manifest.package}@${manifest.version}, ` +
      `but the selected release is ${release.version}`,
  );
}

const target = path.resolve(
  release.sourceManifestPath,
);
await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${target}\n`);

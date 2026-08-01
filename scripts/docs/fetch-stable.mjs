#!/usr/bin/env node
/**
 * Provision and verify the pinned stable release tarball.
 *
 * The documentation gates (`typecheck:docs`, `docs:check`) type-check the
 * published examples against the real `.d.ts` of the last published release.
 * That artifact is pinned by version + sha256 in `types.mjs`.
 *
 * Historically the fetch lived only as inline YAML in the CI workflows, so a
 * local `pnpm verify` (which the pre-push hook runs) failed with a bare
 * "CAVI_API_CLIENT_STABLE_TARBALL is required" unless the developer happened to
 * know the exact pinned version and packed it by hand. This module is the one
 * place that knows how to obtain it, for CI and local runs alike.
 *
 * Resolution order: an explicit env var wins (CI supplies one), otherwise the
 * artifact is fetched into a gitignored cache and digest-verified.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { APPROVED_RELEASE_SHA256, DOCUMENTED_PACKAGE, DOCUMENTED_VERSION } from "./types.mjs";

/** Where fetched artifacts are cached. Gitignored; safe to delete. */
export const STABLE_CACHE_DIRECTORY = path.resolve(".cache/docs-stable");

/** `npm pack` names the file after the package with scope separators flattened. */
export function stableTarballName() {
  return `${DOCUMENTED_PACKAGE.replace("@", "").replace("/", "-")}-${DOCUMENTED_VERSION}.tgz`;
}

export function stableTarballPath() {
  return path.join(STABLE_CACHE_DIRECTORY, stableTarballName());
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Throw unless `tarball` matches the pinned digest for the documented release. */
export function assertApprovedDigest(tarball) {
  const observed = sha256(tarball);
  if (observed !== APPROVED_RELEASE_SHA256) {
    throw new Error(
      `stable artifact digest mismatch for ${tarball}: expected ${APPROVED_RELEASE_SHA256}; observed ${observed}`,
    );
  }
  return tarball;
}

/**
 * Ensure the pinned stable tarball exists in the cache and matches its digest.
 * Re-uses a cached copy when it already verifies; otherwise downloads it from the
 * public npm registry over HTTPS. Returns the absolute path.
 */
export function ensureStableTarball() {
  const target = stableTarballPath();
  if (existsSync(target) && sha256(target) === APPROVED_RELEASE_SHA256) return target;
  mkdirSync(STABLE_CACHE_DIRECTORY, { recursive: true });
  // Public registry HTTPS fetch — no npm CLI / credential helpers.
  const match = /^@(?<scope>[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)\/(?<name>[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)$/u.exec(DOCUMENTED_PACKAGE);
  if (!match?.groups) {
    throw new Error(`invalid scoped package name: ${DOCUMENTED_PACKAGE}`);
  }
  const tarballUrl = `https://registry.npmjs.org/${DOCUMENTED_PACKAGE}/-/${match.groups.name}-${DOCUMENTED_VERSION}.tgz`;
  // stdout stays clean so callers can consume the printed path via `$(...)`.
  execFileSync("curl", ["-fsSL", tarballUrl, "-o", target], { stdio: ["ignore", "ignore", "inherit"] });
  if (!existsSync(target)) {
    throw new Error(`curl did not produce the expected artifact at ${target}`);
  }
  return assertApprovedDigest(target);
}

/**
 * The stable tarball to gate against.
 *
 * The artifact must be supplied EXPLICITLY — the documentation gates never fetch
 * it implicitly, so a build can never silently reach the network for the thing it
 * is meant to be verifying against. Provision it first with `pnpm run docs:stable`
 * (which `pnpm run verify` and both workflows do). Whatever is supplied is still
 * digest-checked; an unverified artifact is never returned.
 *
 * Each caller declares the env vars it honors, in precedence order, rather than
 * sharing one union: a gate that accepts a variable its own contract does not name
 * silently widens its input, and the caller's "this is required" check stops
 * meaning what it says.
 *
 * @param {string[]} [envVars] Env vars to read, highest precedence first.
 */
export function resolveStableTarball(envVars = ["CAVI_API_CLIENT_STABLE_TARBALL"]) {
  const name = envVars.find((variable) => process.env[variable]);
  if (!name) {
    throw new Error(
      `${envVars.join(" or ")} is required; run \`pnpm run docs:stable\` to provision ` +
        `the pinned ${DOCUMENTED_PACKAGE}@${DOCUMENTED_VERSION} artifact, or set it to that .tgz`,
    );
  }
  return assertApprovedDigest(process.env[name]);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  process.stdout.write(`${ensureStableTarball()}\n`);
}

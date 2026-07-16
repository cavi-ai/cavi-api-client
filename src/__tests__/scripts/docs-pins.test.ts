import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  APPROVED_RELEASE_SHA256,
  DOCUMENTED_COMMIT,
  DOCUMENTED_OUTPUT_DIRECTORY,
  DOCUMENTED_PACKAGE,
  DOCUMENTED_SOURCE_DATE_EPOCH,
  DOCUMENTED_TAG,
  DOCUMENTED_VERSION,
} from "../../../scripts/docs/types.mjs";

/**
 * The documentation release pins move together, once per release, and only in
 * types.mjs. Release 0.12.0 bumped package.json but left every pin at 0.11.0 —
 * the drift went unnoticed because the version literal was duplicated across
 * six files and nothing asserted they agreed. These checks are that assertion.
 */
describe("documentation release pins", () => {
  it("keeps the tag in lockstep with the version", () => {
    expect(DOCUMENTED_TAG).toBe(`v${DOCUMENTED_VERSION}`);
  });

  it("pins a full 40-character commit and a 64-character sha256", () => {
    expect(DOCUMENTED_COMMIT).toMatch(/^[0-9a-f]{40}$/u);
    expect(APPROVED_RELEASE_SHA256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("pins a plausible integer reproducible-build timestamp", () => {
    expect(Number.isInteger(DOCUMENTED_SOURCE_DATE_EPOCH)).toBe(true);
    expect(DOCUMENTED_SOURCE_DATE_EPOCH).toBeGreaterThan(0);
  });

  it("derives the canonical output directory from the tag", () => {
    expect(DOCUMENTED_OUTPUT_DIRECTORY).toBe(`docs/api-client/${DOCUMENTED_TAG}`);
  });

  it("ships the documented reference directory in the npm files allowlist", () => {
    const manifest = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      name: string;
      files: string[];
    };
    expect(manifest.name).toBe(DOCUMENTED_PACKAGE);
    // Guards the exact miss from 0.12.0: pins bumped, `files` left behind, so the
    // published tarball would carry a reference directory for the wrong version.
    expect(manifest.files).toContain(DOCUMENTED_OUTPUT_DIRECTORY);
  });

  it("has the documented reference and release manifest present on disk", () => {
    expect(existsSync(path.resolve(DOCUMENTED_OUTPUT_DIRECTORY))).toBe(true);
    expect(
      existsSync(
        path.resolve(`docs/api-client/source/releases/${DOCUMENTED_VERSION}-manifest.json`),
      ),
    ).toBe(true);
  });

  it("agrees with the release manifest it documents", () => {
    const manifest = JSON.parse(
      readFileSync(
        path.resolve(`docs/api-client/source/releases/${DOCUMENTED_VERSION}-manifest.json`),
        "utf8",
      ),
    ) as { package: string; version: string; tag: string; commit: string; sha256: string };
    expect(manifest.package).toBe(DOCUMENTED_PACKAGE);
    expect(manifest.version).toBe(DOCUMENTED_VERSION);
    expect(manifest.tag).toBe(DOCUMENTED_TAG);
    expect(manifest.commit).toBe(DOCUMENTED_COMMIT);
    expect(manifest.sha256).toBe(APPROVED_RELEASE_SHA256);
  });

  it("stamps the documentation source with the documented version", () => {
    const navigation = JSON.parse(
      readFileSync(path.resolve("docs/api-client/source/navigation.json"), "utf8"),
    ) as { version: string };
    expect(navigation.version).toBe(DOCUMENTED_VERSION);
  });
});

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertApprovedDigest,
  normalizePackedTarballGzipOs,
  packWorkspaceTarball,
  PACKED_TARBALL_GZIP_OS_UNIX,
  stableTarballName,
} from "../../../scripts/docs/fetch-stable.mjs";
import { APPROVED_RELEASE_SHA256 } from "../../../scripts/docs/types.mjs";

describe("fetch-stable pack-on-miss helpers", () => {
  it("rejects a tarball whose digest does not match the approved pin", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cavi-fetch-stable-"));
    const bogus = path.join(dir, "bogus.tgz");
    writeFileSync(bogus, "not-the-approved-artifact");
    expect(() => assertApprovedDigest(bogus)).toThrow(/stable artifact digest mismatch/u);
  });

  it("canonicalizes the gzip OS byte so macOS and Linux packs share a digest", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cavi-fetch-stable-gzip-"));
    const file = path.join(dir, "sample.tgz");
    // Minimal gzip header + empty deflate stream + trailer is enough for the OS byte rewrite.
    const bytes = Buffer.alloc(18, 0);
    bytes[0] = 0x1f;
    bytes[1] = 0x8b;
    bytes[2] = 0x08;
    bytes[9] = 19;
    writeFileSync(file, bytes);
    normalizePackedTarballGzipOs(file);
    expect(readFileSync(file)[9]).toBe(PACKED_TARBALL_GZIP_OS_UNIX);
  });

  it("exposes a workspace pack helper that targets the stable cache name", () => {
    expect(stableTarballName()).toMatch(/\.tgz$/u);
    expect(typeof packWorkspaceTarball).toBe("function");
    expect(APPROVED_RELEASE_SHA256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("includes expected and observed digests in the mismatch error", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cavi-fetch-stable-ok-"));
    const file = path.join(dir, "x.tgz");
    writeFileSync(file, "x");
    const observed = createHash("sha256").update("x").digest("hex");
    try {
      assertApprovedDigest(file);
      expect.unreachable("expected digest mismatch");
    } catch (error) {
      expect(String(error)).toContain(APPROVED_RELEASE_SHA256);
      expect(String(error)).toContain(observed);
    }
  });
});

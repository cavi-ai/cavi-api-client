import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
import { resolveDocumentedVersionToken } from "../../../scripts/docs/version-tokens.mjs";

/**
 * Documentation identity: package.json documentation.version is canonical.
 * Commit digest and
 * sourceDateEpoch live on the versioned source manifest and are loaded by
 * scripts/docs/types.mjs. These checks fail if that identity drifts.
 */
describe("documentation release pins", () => {
  it("derives package identity from package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      name: string;
      version: string;
      documentation: { version: string };
    };
    expect(DOCUMENTED_PACKAGE).toBe(pkg.name);
    expect(DOCUMENTED_VERSION).toBe(pkg.documentation.version);
  });

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
    // A directory-only glob omits its descendants from npm pack.
    expect(manifest.files).toContain("docs/api-client/v*/**");
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

  it("resolves the navigation source from the canonical version", () => {
    const navigation = JSON.parse(resolveDocumentedVersionToken(
      readFileSync(path.resolve("docs/api-client/source/navigation.json"), "utf8"),
      DOCUMENTED_VERSION,
      "navigation source",
    )) as { version: string };
    expect(navigation.version).toBe(DOCUMENTED_VERSION);
  });
});

/** Load the real pin module in an isolated candidate checkout, without a registry. */
function loadCandidatePins(documentation: unknown) {
  const root = mkdtempSync(path.join(tmpdir(), "cavi-docs-candidate-"));
  try {
    mkdirSync(path.join(root, "scripts/docs"), { recursive: true });
    mkdirSync(path.join(root, "docs/api-client/source/releases"), { recursive: true });
    cpSync("scripts/docs/types.mjs", path.join(root, "scripts/docs/types.mjs"));
    cpSync(`docs/api-client/source/releases/${DOCUMENTED_VERSION}-manifest.json`,
      path.join(root, `docs/api-client/source/releases/${DOCUMENTED_VERSION}-manifest.json`));
    writeFileSync(path.join(root, "package.json"), JSON.stringify({
      name: DOCUMENTED_PACKAGE, version: "999.0.0", documentation,
    }));
    const moduleUrl = pathToFileURL(path.join(root, "scripts/docs/types.mjs")).href;
    return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
      try {
        const pins = await import(${JSON.stringify(moduleUrl)});
        process.stdout.write(JSON.stringify(pins.resolveDocumentationRelease()));
      } catch (error) {
        process.stdout.write(JSON.stringify({ error: error.message }));
      }
    `], { encoding: "utf8" })) as { version?: string; commit?: string; tarballSha256?: string; error?: string };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("release candidate documentation baseline", () => {
  it("verifies the published baseline independently of a future package version", () => {
    expect(loadCandidatePins({ version: DOCUMENTED_VERSION })).toMatchObject({
      version: DOCUMENTED_VERSION, commit: DOCUMENTED_COMMIT,
      tarballSha256: APPROVED_RELEASE_SHA256,
    });
  });

  it.each([undefined, {}, { version: "../0.18.0" }, { version: "0.19.0-rc.1" }])(
    "rejects a missing or invalid published baseline: %j", (documentation) => {
      expect(loadCandidatePins(documentation)).toEqual({
        error: "package.json documentation.version must pin a stable release version",
      });
    },
  );

  it("rejects a valid version without a matching source artifact manifest", () => {
    expect(loadCandidatePins({ version: "999.0.0" }).error).toContain(
      "missing source release manifest for documented version 999.0.0",
    );
  });
});

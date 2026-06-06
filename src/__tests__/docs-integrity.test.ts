import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Docs-integrity gate. Runs inside `npm test`, so it is part of `verify` and
// `prepublishOnly` — the package cannot be published with documentation that has
// drifted from the shipped version. Keep these checks structural and stable:
// they should fail on real drift, not on prose edits.
const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read = (rel: string) => readFileSync(path.join(PACKAGE_ROOT, rel), "utf8");

const pkg = JSON.parse(read("package.json")) as { version: string };
const changelog = read("CHANGELOG.md");
const readme = read("README.md");

describe("docs integrity", () => {
  it("package.json version has a matching CHANGELOG entry", () => {
    // Before publishing version X.Y.Z, CHANGELOG.md must carry a `## [X.Y.Z]`
    // heading (Keep-a-Changelog). A missing heading means the release notes were
    // not written — fail the build rather than ship undocumented changes.
    const heading = new RegExp(`^## \\[${pkg.version.replace(/\./g, "\\.")}\\]`, "m");
    expect(
      heading.test(changelog),
      `CHANGELOG.md is missing a "## [${pkg.version}]" entry for the current package version`,
    ).toBe(true);
  });

  it("CHANGELOG keeps an Unreleased section for in-flight work", () => {
    expect(changelog).toMatch(/^## \[Unreleased\]/m);
  });

  it("released CHANGELOG headings carry a date", () => {
    // Every released heading (anything that is not [Unreleased]) must be dated,
    // e.g. `## [0.4.0] - 2026-06-06`. Catches a version cut without a date stamp.
    const releasedHeadings = changelog
      .split("\n")
      .filter((line) => /^## \[/.test(line) && !/^## \[Unreleased\]/.test(line));
    expect(releasedHeadings.length).toBeGreaterThan(0);
    for (const line of releasedHeadings) {
      expect(line, `CHANGELOG heading is missing a date: "${line}"`).toMatch(
        /^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}/,
      );
    }
  });

  it("README documents the published subpath exports", () => {
    // The README's import examples must reference subpaths that the package
    // actually exports. Guards against documenting a removed or renamed entry.
    const documentedSubpaths = Array.from(
      readme.matchAll(/@cavi-ai\/api-client(\/[a-z0-9/-]+)/g),
      (m) => m[1],
    );
    const exportedSubpaths = new Set(
      Object.keys((JSON.parse(read("package.json")) as { exports: Record<string, unknown> }).exports),
    );
    for (const subpath of new Set(documentedSubpaths)) {
      expect(
        exportedSubpaths.has(`.${subpath}`),
        `README documents "@cavi-ai/api-client${subpath}" but package.json does not export "${subpath}"`,
      ).toBe(true);
    }
  });
});

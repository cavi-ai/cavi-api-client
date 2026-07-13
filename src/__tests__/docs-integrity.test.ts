import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Docs-integrity gate. Runs inside `npm test`, so it is part of `verify` and
// `prepublishOnly` — the package cannot be published with documentation that has
// drifted from the shipped version. Keep these checks structural and stable:
// they should fail on real drift, not on prose edits.
const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read = (rel: string) => readFileSync(path.join(PACKAGE_ROOT, rel), "utf8");

const pkg = JSON.parse(read("package.json")) as {
  version: string;
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
};
const changelog = read("CHANGELOG.md");
const readme = read("README.md");
const api = read("API.md");
const architecture = read("ARCHITECTURE.md");

describe("docs integrity", () => {
  it("publishes reproducible documentation build and drift-check commands", () => {
    expect(pkg.scripts["docs:build"]).toBeDefined();
    expect(pkg.scripts["docs:check"]).toBeDefined();
    expect(pkg.scripts.verify).toContain("docs:check");
  });

  it("commits the generated reference artifact for the package version", () => {
    const manifest = JSON.parse(read("docs/api-client/v0.11.0/manifest.json")) as {
      version: string;
    };
    expect(manifest.version).toBe("0.11.0");
  });

  it("lists every package export in generated reference navigation", () => {
    const navigation = read("docs/api-client/v0.11.0/navigation.json");
    for (const subpath of Object.keys(pkg.exports)) {
      expect(navigation, `generated navigation is missing package export ${subpath}`).toContain(subpath);
    }
  });

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

  it("documents every published subpath export in the README", () => {
    // Reverse of the check above: every package.json export key (other than
    // the root ".") must be mentioned in README.md at least once, so a new
    // export can't ship undocumented. Matches on the export key's path
    // portion (the key minus its leading ".") rather than requiring the
    // literal "@cavi-ai/api-client" prefix, since some exports — e.g. the
    // clip-contract JSON asset — are documented by their relative export
    // path instead of a package-specifier import path.
    const exportedKeys = Object.keys(
      (JSON.parse(read("package.json")) as { exports: Record<string, unknown> }).exports,
    ).filter((key) => key !== ".");
    for (const key of exportedKeys) {
      const pathPortion = key.slice(1);
      expect(
        readme.includes(pathPortion),
        `package.json exports "${key}" but README.md never mentions it`,
      ).toBe(true);
    }
  });

  it("API.md documents no private host-deployment surfaces the package doesn't implement", () => {
    // API.md is the package's public route catalog; it must describe only what the
    // code implements. Private CAVI deployment plugins / persona portals once leaked
    // in as hand-written rows (martina/scout/angela/machine/front-door/trading/wu-tang
    // — 0 occurrences in src). The durable fix is to regenerate API.md from the
    // *paths.ts / *surfaces.ts owner files; this guard backstops that.
    const apiMd = read("API.md");

    // 1) The portal surface must use the generic `:portal` dispatcher — never a baked
    //    persona. The manifest supplies portal identity at runtime. This catches ANY
    //    hardcoded persona, not just the ones removed once.
    const bakedPortals = [
      ...new Set(
        Array.from(apiMd.matchAll(/\/api\/plugins\/portal\/([a-z][a-z0-9-]*)\//g), (m) => m[1]),
      ),
    ];
    expect(
      bakedPortals,
      `API.md hardcodes portal persona(s) instead of the :portal dispatcher: ${bakedPortals.join(", ")}`,
    ).toEqual([]);

    // 2) Known private deployment plugins that this package does not implement.
    const forbidden = [
      "martina",
      "wuTang",
      "wu-tang",
      "frontDoor",
      "front-door",
      "/plugins/trading",
      "/plugins/machine/",
    ];
    const leaked = forbidden.filter((token) => apiMd.includes(token));
    expect(
      leaked,
      `API.md references private surfaces not implemented in this package: ${leaked.join(", ")}`,
    ).toEqual([]);
  });

  it("API.md documents the runtime control-plane foundation without advertising adapters", () => {
    const apiMd = read("API.md");

    for (const publicContract of [
      "RuntimeControlPlane",
      "RuntimeEventClient",
      "RuntimeTransportCapabilities",
      "RuntimeAuthStatus",
    ]) {
      expect(apiMd, `API.md is missing ${publicContract}`).toContain(publicContract);
    }
    expect(apiMd).toContain(
      "All provider control-plane module declarations are initially empty until provider adapter plans land.",
    );
  });

  it("ships compile-checked consumer journeys", () => {
    for (const file of [
      "runtime-node.ts",
      "runtime-browser.ts",
      "runtime-registry.ts",
      "custom-provider.ts",
      "runtime-capabilities.ts",
      "custom-runtime-provider.ts",
      "react-gateway.tsx",
      "narrow-imports.ts",
      "runtime-transport-browser.ts",
      "runtime-transport-node.ts",
    ]) {
      expect(existsSync(path.join(PACKAGE_ROOT, "docs/examples", file)), file).toBe(true);
    }
  });

  it("documents the shared transport runtime and its isolation boundaries", () => {
    const publicDocs = `${readme}\n${api}\n${architecture}\n${changelog}`;

    for (const token of [
      "@cavi-ai/api-client/core/transport",
      "@cavi-ai/api-client/core/transport/node",
      "createHttpTransport",
      "createJsonRpcTransport",
      "createSseTransport",
      "createWebSocketTransport",
      "createStdioTransport",
      "createUnixSocketTransport",
    ]) {
      expect(publicDocs, `transport docs are missing ${token}`).toContain(token);
    }
    expect(publicDocs).toMatch(/(?:no|never)[ -](?:write )?replay/iu);
    expect(publicDocs).toMatch(/Node(?:-only| isolation| built-ins)/u);
    expect(publicDocs).toMatch(/not (?:a )?provider adapter/iu);
  });
});

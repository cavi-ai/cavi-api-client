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
  files: string[];
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

  it("publishes an immutable documentation consumer handoff", () => {
    const consumer = read("docs/api-client/CONSUMER.md");

    for (const contract of [
      "source: docs/api-client/v0.11.0",
      "publicBasePath: /docs/api-client/v0.11.0",
      "stableAlias: /docs/api-client",
      "entrypoints: manifest.json, navigation.json",
      "identity: manifest.package",
      "sourceIntegrity: manifest.sourceTarballSha256",
      "contentIntegrity: manifest.contentSha256",
    ]) {
      expect(consumer).toContain(contract);
    }
    expect(consumer).toContain("must not edit generated pages");
    expect(consumer).toContain("fail ingestion on a version or digest mismatch");
    expect(consumer).toContain("already-published npm package `@cavi-ai/api-client@0.11.0` does not contain");

    expect(pkg.files).toContain("docs/api-client/CONSUMER.md");
    expect(pkg.files).toContain("docs/api-client/v0.11.0");
    expect(pkg.files).toContain("!docs/api-client/source");
    expect(pkg.files).toContain("!docs/api-client/source/**");
    expect(pkg.files).toContain("!docs/superpowers");
    expect(pkg.files).toContain("!docs/superpowers/**");

    expect(readme).toContain("pnpm docs:check");
    expect(readme).toContain("docs/api-client/v0.11.0");
    expect(api).toContain("pnpm docs:check");
    expect(api).toContain("docs/api-client/v0.11.0");
    expect(changelog).toContain("versioned documentation consumer contract");
  });

  it("maps the exact stable release manifest to generated reference navigation", () => {
    const stableManifest = JSON.parse(read("docs/api-client/source/releases/0.11.0-manifest.json")) as {
      exports: Array<{ subpath: string; kind: "declaration" | "asset"; types?: string; target?: string }>;
    };
    const navigation = JSON.parse(read("docs/api-client/v0.11.0/navigation.json")) as {
      reference: Array<{ subpath: string; kind: "declaration" | "asset"; path?: string; target?: string }>;
    };
    expect(navigation.reference.map(({ subpath }) => subpath)).toEqual(
      stableManifest.exports.map(({ subpath }) => subpath).sort(),
    );
    for (const entry of navigation.reference) {
      const stableExport = stableManifest.exports.find(({ subpath }) => subpath === entry.subpath)!;
      expect(entry.kind).toBe(stableExport.kind);
      if (entry.kind === "declaration") {
        expect(entry.path).toMatch(/^reference\/.+\.md$/u);
        expect(existsSync(path.join(PACKAGE_ROOT, "docs/api-client/v0.11.0", entry.path!))).toBe(true);
      } else {
        expect(entry.path).toBeUndefined();
        expect(entry.target).toBe(stableExport.target);
      }
    }
  });

  it("provisions immutable stable docs inputs before publish verification", () => {
    const workflow = read(".github/workflows/publish.yml");
    expect(workflow).toContain("CAVI_API_CLIENT_STABLE_TARBALL:");
    expect(workflow).toContain("CAVI_DOCS_PACKAGE_TGZ:");
    expect(workflow).toContain("SOURCE_DATE_EPOCH: 1783740944");
    expect(workflow).toContain("3379cd47b4890d0e00f5949583f90a83367705878b16141e825f66ef5d8819e5");
    expect(workflow).toContain("npm pack @cavi-ai/api-client@0.11.0");
    expect(workflow).not.toContain("${{ runner.temp }}");
    expect(workflow.indexOf("Provision stable documentation artifact")).toBeLessThan(
      workflow.indexOf("Verify package"),
    );
  });

  it("provisions immutable stable docs inputs before CI documentation typechecking", () => {
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow).toContain("CAVI_API_CLIENT_STABLE_TARBALL:");
    expect(workflow).toContain("CAVI_DOCS_PACKAGE_TGZ:");
    expect(workflow).toContain("SOURCE_DATE_EPOCH: 1783740944");
    expect(workflow).toContain("3379cd47b4890d0e00f5949583f90a83367705878b16141e825f66ef5d8819e5");
    expect(workflow).toContain("npm pack @cavi-ai/api-client@0.11.0");
    expect(workflow).not.toContain("${{ runner.temp }}");
    expect(workflow.indexOf("Provision stable documentation artifact")).toBeLessThan(
      workflow.indexOf("Typecheck documentation examples"),
    );
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

  it("API.md truthfully documents the registered OpenClaw adapter", () => {
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
      "OpenClaw declares all seven canonical modules and its stable WebSocket transport",
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

  it("documents the canonical control-plane facade without provider drift", () => {
    const publicDocs = [readme, api, architecture, changelog];
    const modules = ["authStatus", "sessions", "models", "usage", "tasks", "workspace", "events"];

    for (const [name, document] of [
      ["README.md", readme],
      ["API.md", api],
    ] as const) {
      expect(document, `${name} is missing the provider-neutral factory example`).toContain(
        "createRuntimeControlPlane(config.provider, {",
      );
      expect(document).toContain("controlPlane.sessions.listSessions({ limit: 50 })");
      expect(document).not.toContain(".sessions.list(");
    }

    for (const module of modules) {
      expect(
        publicDocs.every((document) => document.includes(module)),
        `${module} is not synchronized`,
      ).toBe(true);
    }
    for (const method of [
      "agents.list",
      "models.list",
      "models.authStatus",
      "usage.status",
      "usage.cost",
      "sessions.list",
      "sessions.describe",
      "sessions.abort",
      "tasks.list",
      "tasks.get",
      "tasks.cancel",
    ]) {
      expect(api, `API.md is missing verified OpenClaw method ${method}`).toContain(`\`${method}\``);
    }

    expect(publicDocs.every((document) => document.includes("CapabilityUnavailable"))).toBe(true);
    expect(`${readme}\n${api}`).toMatch(/upstream wire APIs remain\s+provider-owned and mirrored/iu);
    const eventContinuityDocs = `${readme}\n${api}\n${architecture}\n${changelog}`;
    expect(eventContinuityDocs).toContain(
      'CapabilityUnavailable("openclaw", "controlPlane.events.cursor")',
    );
    expect(eventContinuityDocs).toContain("stream.reconnected");
    expect(eventContinuityDocs).toContain("stream.gap");
    expect(eventContinuityDocs).toMatch(/cursor resume is unsupported/iu);
    expect(eventContinuityDocs).toMatch(/does not claim replay/iu);
    expect(`${api}\n${architecture}`).toMatch(/caller-owned/iu);
    expect(`${api}\n${architecture}`).toMatch(/client-owned/iu);
  });
});

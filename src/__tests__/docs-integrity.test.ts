import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DOCUMENTED_OUTPUT_DIRECTORY,
  DOCUMENTED_PACKAGE,
  DOCUMENTED_VERSION,
  resolveDocumentationRelease,
} from "../../scripts/docs/types.mjs";
import {
  DOCUMENTED_RELEASE_MANIFEST_PATH,
  DOCUMENTED_RELEASE_SPECIFIER,
} from "./support/documented-release.js";

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
const exportsGuide = read("docs/guides/exports.md");
const developmentGuide = read("docs/guides/development.md");
// Control-plane facade + OpenClaw adapter docs migrated from API.md into the
// operation reference pipeline (API.md is now an index/pointer).
const controlPlaneOps = read(
  "docs/api-client/source/pages/operations/gateway/control-plane.md",
);
const openclawOps = read(
  "docs/api-client/source/pages/operations/providers/openclaw.md",
);

describe("docs integrity", () => {
  it("publishes reproducible documentation build and drift-check commands", () => {
    expect(pkg.scripts["docs:build"]).toBeDefined();
    expect(pkg.scripts["docs:check"]).toBeDefined();
    expect(pkg.scripts.verify).toContain("docs:check");
  });

  it("reports validated dry-run artifact evidence before the release envelope", () => {
    const workflow = read(".github/workflows/publish.yml");
    expect(pkg.scripts["docs:release-dry-run-report"])
      .toBe("node scripts/docs/report-release-dry-run.mjs");
    expect(workflow).toContain("manifest=$MANIFEST");
    const report = workflow.indexOf("pnpm run docs:release-dry-run-report");
    expect(report).toBeGreaterThan(-1);
    expect(report).toBeGreaterThan(workflow.indexOf("Report non-mutating dry run"));
    expect(report).toBeLessThan(workflow.indexOf("Upload immutable release assets"));
    expect(workflow.slice(
      workflow.indexOf("Report non-mutating dry run"),
      workflow.indexOf("Upload immutable release assets"),
    )).toContain('--manifest "$MANIFEST"');
  });

  it("commits the generated reference artifact for the package version", () => {
    // Independent sides: the COMMITTED artifact's own contents vs the pin. Fails
    // when a bump lands without regenerating the reference.
    const release = resolveDocumentationRelease();
    const manifest = JSON.parse(read(`${release.outputDirectory}/manifest.json`)) as {
      package: string;
      version: string;
    };
    expect(release.outputDirectory).toBe(DOCUMENTED_OUTPUT_DIRECTORY);
    expect(manifest.package).toBe(DOCUMENTED_PACKAGE);
    expect(manifest.version).toBe(DOCUMENTED_VERSION);
  });

  it("publishes an immutable documentation consumer handoff", () => {
    const consumer = read("docs/api-client/CONSUMER.md");

    for (const contract of [
      `source: ${DOCUMENTED_OUTPUT_DIRECTORY}`,
      `publicBasePath: /${DOCUMENTED_OUTPUT_DIRECTORY}`,
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
    expect(consumer).toContain("repository source is the editable documentation authority");
    expect(consumer).toContain("GitHub Release asset is the immutable delivery authority");
    expect(consumer).toContain("cavi-release.json");
    expect(consumer).toContain("cavi-oss-release");
    expect(consumer).toContain("historical backfill");

    expect(pkg.files).toContain("docs/api-client/CONSUMER.md");
    expect(pkg.files).toContain(DOCUMENTED_OUTPUT_DIRECTORY);
    expect(pkg.files).toContain("!docs/api-client/source");
    expect(pkg.files).toContain("!docs/api-client/source/**");
    expect(pkg.files).toContain("!docs/superpowers");
    expect(pkg.files).toContain("!docs/superpowers/**");

    expect(developmentGuide).toContain("pnpm run verify");
    expect(developmentGuide).toContain("CAVI_API_CLIENT_STABLE_TARBALL");
    expect(readme).toContain(DOCUMENTED_OUTPUT_DIRECTORY);
    expect(api).toContain("pnpm docs:check");
    expect(api).toContain(DOCUMENTED_OUTPUT_DIRECTORY);
    expect(changelog).toContain("versioned documentation consumer contract");
  });

  it("maps the exact stable release manifest to generated reference navigation", () => {
    const stableManifest = JSON.parse(read(DOCUMENTED_RELEASE_MANIFEST_PATH)) as {
      exports: Array<{ subpath: string; kind: "declaration" | "asset"; types?: string; target?: string }>;
    };
    const navigation = JSON.parse(read(`${DOCUMENTED_OUTPUT_DIRECTORY}/navigation.json`)) as {
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
        expect(existsSync(path.join(PACKAGE_ROOT, DOCUMENTED_OUTPUT_DIRECTORY, entry.path!))).toBe(true);
      } else {
        expect(entry.path).toBeUndefined();
        expect(entry.target).toBe(stableExport.target);
      }
    }
  });

  // The provisioning contract is unchanged — an immutable, digest-verified stable
  // artifact must exist before any documentation gate runs. What changed is where
  // it is enforced: the version and sha256 used to be duplicated as literals in
  // both workflows (and four other files), which is exactly how the 0.12.0 release
  // drifted. They now live once in scripts/docs/types.mjs, and fetch-stable.mjs
  // performs the fetch + digest check for CI and local runs alike. These tests
  // assert the guarantee at its new home rather than string-matching YAML.
  it("enforces an immutable, digest-verified stable artifact in one shared place", () => {
    const fetchStable = read("scripts/docs/fetch-stable.mjs");
    // The pin is read from types.mjs rather than restated, and a mismatch is fatal.
    // That a supplied artifact is actually rejected on mismatch is proven
    // behaviourally by docs-renderer.test.ts ("rejects a stable tarball whose
    // digest does not match") — asserting the implementation line here would only
    // break on refactors without adding protection.
    expect(fetchStable).toContain("APPROVED_RELEASE_SHA256");
    expect(fetchStable).toContain("stable artifact digest mismatch");
    expect(pkg.scripts["docs:stable"]).toBe("node scripts/docs/fetch-stable.mjs");
  });

  // Each workflow `run:` step is its own shell, so provisioning must publish the
  // artifact path to $GITHUB_ENV for the later gate steps to receive it. Asserting
  // only that the step exists is not enough — that is exactly the gap that let a
  // provision step ship without wiring the value through.
  const assertProvisionsStableArtifact = (workflow: string, beforeStep: string) => {
    expect(workflow).toContain("node scripts/docs/fetch-stable.mjs");
    expect(workflow).toContain('echo "CAVI_API_CLIENT_STABLE_TARBALL=$TARBALL" >> "$GITHUB_ENV"');
    expect(workflow).toContain('echo "CAVI_DOCS_PACKAGE_TGZ=$TARBALL" >> "$GITHUB_ENV"');
    expect(workflow).not.toContain("${{ runner.temp }}");
    // No release-coupled literals may reappear in the workflow.
    expect(workflow).not.toContain(`npm pack ${DOCUMENTED_PACKAGE}@`);
    expect(workflow).not.toContain("SOURCE_DATE_EPOCH:");
    expect(workflow.indexOf("Provision stable documentation artifact")).toBeLessThan(
      workflow.indexOf(beforeStep),
    );
  };

  it("provisions immutable stable docs inputs before publish verification", () => {
    assertProvisionsStableArtifact(read(".github/workflows/publish.yml"), "Verify package");
  });

  it("preserves dependency notifications alongside required docs delivery", () => {
    const publishWorkflow = read(".github/workflows/publish.yml");
    expect(existsSync(path.join(
      PACKAGE_ROOT,
      ".github/consumer-templates/on-api-client-released.yml",
    ))).toBe(true);
    expect(publishWorkflow).toContain("notify-consumers:");
    expect(publishWorkflow).toContain('event_type=api-client-released');
    expect(publishWorkflow).toContain("API_CLIENT_CONSUMER_REPOS");
    expect(publishWorkflow).toContain("Dispatch required cavi-home ingestion");
    expect(publishWorkflow).toContain('event_type: "cavi-oss-release"');
  });

  it("provisions immutable stable docs inputs before CI documentation typechecking", () => {
    assertProvisionsStableArtifact(read(".github/workflows/ci.yml"), "Typecheck documentation examples");
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

  it("public guides document only published subpath exports", () => {
    // Consumer-facing import examples must reference subpaths that the package
    // actually exports. The README stays a concise front door; the linked
    // exports guide owns the exhaustive catalog.
    const publicImportDocs = `${readme}\n${exportsGuide}`;
    const documentedSubpaths = Array.from(
      publicImportDocs.matchAll(/@cavi-ai\/api-client(\/[a-z0-9./-]+)/g),
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

  it("documents every published subpath export in the exports guide", () => {
    // Reverse of the check above: every package.json export key (other than
    // the root ".") must be mentioned in the focused exports guide, so a new
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
        exportsGuide.includes(pathPortion),
        `package.json exports "${key}" but docs/guides/exports.md never mentions it`,
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

  it("truthfully documents the registered OpenClaw adapter in the operation reference", () => {
    for (const publicContract of [
      "RuntimeControlPlane",
      "RuntimeEventClient",
      "RuntimeTransportCapabilities",
      "RuntimeAuthStatus",
    ]) {
      expect(
        openclawOps,
        `operations/providers/openclaw.md is missing ${publicContract}`,
      ).toContain(publicContract);
    }
    expect(openclawOps).toContain(
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
    const publicDocs = `${readme}\n${exportsGuide}\n${api}\n${architecture}\n${changelog}`;

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
    const publicDocs = [controlPlaneOps, architecture, changelog];
    const modules = ["authStatus", "sessions", "models", "usage", "tasks", "workspace", "events"];

    for (const [name, document] of [
      ["operations/gateway/control-plane.md", controlPlaneOps],
    ] as const) {
      expect(document, `${name} is missing the provider-neutral factory example`).toContain(
        "createRuntimeControlClient(config.provider, {",
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
      expect(
        controlPlaneOps,
        `operations/gateway/control-plane.md is missing verified OpenClaw method ${method}`,
      ).toContain(`\`${method}\``);
    }

    expect(publicDocs.every((document) => document.includes("CapabilityUnavailable"))).toBe(true);
    expect(controlPlaneOps).toMatch(
      /upstream wire APIs remain\s+provider-owned and mirrored/iu,
    );
    const eventContinuityDocs = `${readme}\n${controlPlaneOps}\n${architecture}\n${changelog}`;
    expect(eventContinuityDocs).toContain(
      'CapabilityUnavailable("openclaw", "controlPlane.events.cursor")',
    );
    expect(eventContinuityDocs).toContain("stream.reconnected");
    expect(eventContinuityDocs).toContain("stream.gap");
    expect(eventContinuityDocs).toMatch(/cursor resume is unsupported/iu);
    expect(eventContinuityDocs).toMatch(/does not claim replay/iu);
    expect(`${controlPlaneOps}\n${architecture}`).toMatch(/caller-owned/iu);
    expect(`${controlPlaneOps}\n${architecture}`).toMatch(/client-owned/iu);
  });
});

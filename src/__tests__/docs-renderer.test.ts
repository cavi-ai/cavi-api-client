import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildDocumentation } from "../../scripts/docs/build.mjs";
import { loadContracts } from "../../scripts/docs/contracts.mjs";
import {
  renderDocumentation,
  subpathSlug,
  validateRenderedDocumentation,
} from "../../scripts/docs/render.mjs";

const root = path.resolve(".");
const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
let manifest: import("../../scripts/docs/types.mjs").ReleaseManifest;
let contracts: Awaited<ReturnType<typeof loadContracts>>;
let navigation: unknown;

let curatedPaths: string[];

async function markdownPaths(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return markdownPaths(path.join(directory, entry.name), relative);
    return entry.isFile() && entry.name.endsWith(".md") ? [relative] : [];
  }));
  return paths.flat().sort();
}

function navigationPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(navigationPaths);
  if (!value || typeof value !== "object") return [];
  const entry = value as Record<string, unknown>;
  return [
    ...(typeof entry.path === "string" ? [entry.path] : []),
    ...Object.values(entry).flatMap(navigationPaths),
  ];
}

beforeAll(async () => {
  manifest = JSON.parse(
    await readFile("docs/api-client/source/releases/0.11.0-manifest.json", "utf8"),
  );
  contracts = await loadContracts(root, manifest);
  navigation = JSON.parse(
    await readFile("docs/api-client/source/navigation.json", "utf8"),
  );
  curatedPaths = await markdownPaths("docs/api-client/source/pages");
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

function render() {
  return renderDocumentation({
    manifest,
    contracts,
    navigation,
    curatedRoot: path.join(root, "docs/api-client/source"),
    sourceDateEpoch: 1_700_000_000,
  });
}

describe("renderDocumentation", () => {
  it("renders byte-identical portable output from the same stable inputs", () => {
    expect([...render()]).toEqual([...render()]);
    expect([...render().keys()]).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "navigation.json",
        "reference/index.md",
        "reference/core-runtime.md",
        "contracts/runtime-request.md",
      ]),
    );
  });

  it("excludes examples that require unreleased declarations", () => {
    const output = render();

    expect(output.has("examples/custom-runtime-provider.ts")).toBe(false);
    expect(output.has("examples/runtime-node.ts")).toBe(true);
  });

  it("rejects destructive output roots", async () => {
    await expect(buildDocumentation([
      "--tarball", "/tmp/release.tgz",
      "--output", root,
      "--source-date-epoch", "1700000000",
    ])).rejects.toThrow(/unsafe documentation output directory/u);
  });

  it("covers every stable subpath and symbol exactly once", () => {
    const output = render();

    expect(() => validateRenderedDocumentation(output, manifest)).not.toThrow();
    for (const releaseExport of manifest.exports) {
      if (releaseExport.kind === "declaration") {
        expect(output.has(`reference/${subpathSlug(releaseExport.subpath)}.md`)).toBe(true);
      }
    }
  });

  it("maps the exact stable manifest to typed navigation targets", () => {
    const output = render();
    const renderedNavigation = JSON.parse(output.get("navigation.json")!) as {
      reference: Array<{ subpath: string; kind: string; path?: string; target?: string }>;
    };

    expect(renderedNavigation.reference.map(({ subpath }) => subpath)).toEqual(
      manifest.exports.map(({ subpath }) => subpath).sort(),
    );
    for (const entry of renderedNavigation.reference) {
      const stableExport = manifest.exports.find(({ subpath }) => subpath === entry.subpath)!;
      expect(entry.kind).toBe(stableExport.kind);
      if (stableExport.kind === "declaration") {
        expect(entry.path).toBe(`reference/${subpathSlug(entry.subpath)}.md`);
        expect(output.has(entry.path!)).toBe(true);
        expect(entry.target).toBeUndefined();
      } else {
        expect(entry.path).toBeUndefined();
        expect(entry.target).toBe(stableExport.target);
      }
    }
  });

  it("resolves every curated navigation page exactly once", () => {
    const output = render();
    const paths = navigationPaths(navigation);

    for (const pagePath of paths) {
      expect(output.has(pagePath), `${pagePath} must resolve from navigation`).toBe(true);
    }

    const curatedNavigationPaths = paths.filter((pagePath) =>
      !pagePath.startsWith("reference/") && !pagePath.startsWith("contracts/")
    ).sort();
    expect(curatedNavigationPaths).toEqual(curatedPaths);
  });

  it.each(["../escape.md", "/absolute.md", "concepts/./escape.md"])("rejects unsafe navigation path %s", (unsafePath) => {
    expect(() => renderDocumentation({ manifest, contracts, navigation: { path: unsafePath }, curatedRoot: path.join(root, "docs/api-client/source"), sourceDateEpoch: 1_700_000_000 })).toThrow(/navigation path|curated page path/u);
  });

  it("keeps every rendered relative Markdown link inside the artifact", () => {
    const output = render();
    for (const [pagePath, contents] of output) {
      if (!pagePath.endsWith(".md")) continue;
      for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
        const target = match[1].split("#", 1)[0];
        if (!target || /^(?:[a-z]+:|\/)/iu.test(target)) continue;
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), target));
        expect(output.has(resolved), `${pagePath} links to missing artifact path ${resolved}`).toBe(true);
      }
    }
  });

  it("locks every curated page to the documented mirror release", () => {
    const output = render();
    const notice = "This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.";

    for (const pagePath of curatedPaths) {
      const page = output.get(pagePath)!;
      expect(page, pagePath).toMatch(/^---\ndocumentedVersion: 0\.11\.0\n---\n/u);
      expect(page, pagePath).toContain(notice);
    }
  });

  it("renders validated contract metadata and source-derived generation time", () => {
    const request = render().get("contracts/runtime-request.md");
    const metadata = JSON.parse(render().get("manifest.json")!);

    expect(request).toContain("Source of truth: upstream-compatible-mirror");
    expect(request).toMatch(/^# Runtime request\n\nPackage: @cavi-ai\/api-client\nVerified by: declaration \+ fixture \+ conformance test\n/u);
    expect(request).toContain("Capability: supported");
    expect(request).toContain("RuntimeRunStartBody");
    expect(metadata).toMatchObject({
      package: "@cavi-ai/api-client",
      version: "0.11.0",
      release: { tag: "v0.11.0" },
      sourceTarballSha256: manifest.sha256,
      contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      publicExports: manifest.exports,
      schemaVersion: 2,
      generatedAt: "2023-11-14T22:13:20.000Z",
    });
  });

  it("renders package and derived verification headers on every contract page", () => {
    const output = render();
    for (const contract of contracts) {
      const page = output.get(`contracts/${contract.id}.md`)!;
      expect(page, contract.id).toContain("Package: @cavi-ai/api-client");
      expect(page, contract.id).toContain("Verified by: declaration + fixture + conformance test");
    }
  });

  it("rejects a stable contract missing a required evidence type", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "cavi-docs-contract-test-"));
    temporaryDirectories.push(workspace);
    const contract = JSON.parse(await readFile("docs/api-client/source/contracts/capabilities.json", "utf8"));
    contract.evidence = contract.evidence.filter(({ type }: { type: string }) => type !== "fixture");
    await mkdir(path.join(workspace, "docs/api-client/source/contracts"), { recursive: true });
    await writeFile(path.join(workspace, "docs/api-client/source/contracts/capabilities.json"), `${JSON.stringify(contract, null, 2)}\n`);
    for (const evidence of contract.evidence) {
      const destination = path.join(workspace, evidence.path);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "evidence\n");
    }

    await expect(loadContracts(workspace, manifest)).rejects.toThrow(
      "capabilities: expected evidence to include fixture; observed missing",
    );
  });

  it("renders the exact stable declaration signature without a placeholder fallback", () => {
    const stableSignature = [
      "export declare function request<TInput, TOutput>(",
      "    input: TInput,",
      "    options?: { signal?: AbortSignal },",
      "): Promise<TOutput>;",
    ].join("\n");
    const stableManifest = {
      package: "@cavi-ai/api-client",
      version: "0.11.0",
      sha256: "a".repeat(64),
      exports: [{ subpath: ".", kind: "declaration", types: "./dist/index.d.ts" }],
      symbols: [{ subpath: ".", name: "request", kind: "function", signature: stableSignature }],
    };

    const output = renderDocumentation({
      manifest: stableManifest,
      contracts: [],
      navigation: {},
      curatedRoot: "unused",
      sourceDateEpoch: 1_700_000_000,
    });
    const page = output.get("reference/index.md")!;

    expect(page).toContain(stableSignature);
    expect(page).not.toContain("export function request;");
  });

  it("rejects a stable manifest symbol without an inspected declaration signature", () => {
    expect(() => renderDocumentation({
      manifest: {
        package: "@cavi-ai/api-client",
        version: "0.11.0",
        sha256: "a".repeat(64),
        exports: [{ subpath: ".", kind: "declaration", types: "./dist/index.d.ts" }],
        symbols: [{ subpath: ".", name: "request", kind: "function", signature: "" }],
      },
      contracts: [],
      navigation: {},
      curatedRoot: "unused",
      sourceDateEpoch: 1_700_000_000,
    })).toThrow(".:request: expected declaration signature from stable release manifest; observed missing");
  });

  it("production build rejects a synthetic fixture despite arbitrary CLI arguments", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "cavi-docs-build-test-"));
    temporaryDirectories.push(workspace);
    const fixtureRoot = path.join(workspace, "root");
    const output = path.join(workspace, "output");
    await mkdir(path.join(fixtureRoot, "docs/api-client/source/contracts"), { recursive: true });
    await writeFile(
      path.join(fixtureRoot, "docs/api-client/source/navigation.json"),
      '{"title":"fixture"}\n',
    );

    await expect(buildDocumentation(["--output", output])).rejects.toThrow(
      "missing required option --tarball",
    );
    const tarball = path.join(workspace, "release.tgz");
    await execFileAsync("tar", ["-czf", tarball, "package"], {
      cwd: path.resolve("src/__tests__/fixtures/docs-release"),
    });
    await expect(buildDocumentation([
      "--source-date-epoch", "1700000000",
      "--root", fixtureRoot,
      "--tarball", tarball,
      "--expected-sha256", "0".repeat(64),
      "--output", output,
    ])).rejects.toThrow("unsupported option --expected-sha256");
  });

  it("production check rejects a synthetic fixture before drift comparison", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "cavi-docs-check-test-"));
    temporaryDirectories.push(workspace);
    const tarball = path.join(workspace, "release.tgz");
    const committed = path.join(workspace, "committed");
    const fixtureRoot = path.join(workspace, "root");
    await mkdir(path.join(fixtureRoot, "docs/api-client/source/contracts"), { recursive: true });
    await writeFile(
      path.join(fixtureRoot, "docs/api-client/source/navigation.json"),
      '{"title":"fixture"}\n',
    );
    await execFileAsync("tar", ["-czf", tarball, "package"], {
      cwd: path.resolve("src/__tests__/fixtures/docs-release"),
    });
    await mkdir(committed, { recursive: true });

    await expect(execFileAsync(process.execPath, [
      "scripts/docs/check.mjs",
      "--package", tarball,
      "--out", committed,
      "--source-date-epoch", "1700000000",
      "--root", fixtureRoot,
    ])).rejects.toMatchObject({
      stderr: expect.stringContaining("stable artifact digest mismatch"),
    });
  });

  it("requires an explicit stable tarball for docs typechecking", async () => {
    const env = { ...process.env };
    delete env.CAVI_API_CLIENT_STABLE_TARBALL;
    await expect(execFileAsync(process.execPath, ["scripts/docs/typecheck-stable.mjs"], { env }))
      .rejects.toMatchObject({ stderr: expect.stringContaining("CAVI_API_CLIENT_STABLE_TARBALL is required") });
  });

  it("rejects a stable tarball whose digest does not match", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "cavi-docs-digest-test-"));
    temporaryDirectories.push(workspace);
    const tarball = path.join(workspace, "wrong.tgz");
    await writeFile(tarball, "not the stable artifact");
    await expect(execFileAsync(process.execPath, ["scripts/docs/typecheck-stable.mjs"], {
      env: { ...process.env, CAVI_API_CLIENT_STABLE_TARBALL: tarball },
    })).rejects.toMatchObject({ stderr: expect.stringContaining("stable artifact digest mismatch") });
  });

  it("rejects a missing symbol page with its exact subpath and symbol", () => {
    const output = render();
    output.delete("reference/core-runtime.md");

    expect(() => validateRenderedDocumentation(output, manifest)).toThrow(
      "./core/runtime:RuntimeCapabilities",
    );
  });

  it("rejects a duplicate symbol anchor with its exact subpath and symbol", () => {
    const output = render();
    const page = output.get("reference/core-runtime.md")!;
    const anchor = '<a id="symbol-core-runtime-runtimecapabilities"></a>';
    output.set("reference/core-runtime.md", `${page}\n${anchor}\n`);

    expect(() => validateRenderedDocumentation(output, manifest)).toThrow(
      "./core/runtime:RuntimeCapabilities",
    );
  });
});

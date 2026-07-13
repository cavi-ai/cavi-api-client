import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

beforeAll(async () => {
  manifest = JSON.parse(
    await readFile("docs/api-client/source/releases/0.11.0-manifest.json", "utf8"),
  );
  contracts = await loadContracts(root, manifest);
  navigation = JSON.parse(
    await readFile("docs/api-client/source/navigation.json", "utf8"),
  );
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

  it("covers every stable subpath and symbol exactly once", () => {
    const output = render();

    expect(() => validateRenderedDocumentation(output, manifest)).not.toThrow();
    for (const releaseExport of manifest.exports) {
      expect(output.has(`reference/${subpathSlug(releaseExport.subpath)}.md`)).toBe(true);
    }
  });

  it("renders validated contract metadata and source-derived generation time", () => {
    const request = render().get("contracts/runtime-request.md");
    const metadata = JSON.parse(render().get("manifest.json")!);

    expect(request).toContain("Source of truth: upstream-compatible-mirror");
    expect(request).toContain("Capability: supported");
    expect(request).toContain("RuntimeRunStartBody");
    expect(metadata).toMatchObject({
      package: "@cavi-ai/api-client",
      version: "0.11.0",
      tag: "v0.11.0",
      sha256: manifest.sha256,
      schemaVersion: 1,
      generatedAt: "2023-11-14T22:13:20.000Z",
    });
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
      exports: [{ subpath: ".", types: "./dist/index.d.ts" }],
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
        exports: [{ subpath: ".", types: "./dist/index.d.ts" }],
        symbols: [{ subpath: ".", name: "request", kind: "function", signature: "" }],
      },
      contracts: [],
      navigation: {},
      curatedRoot: "unused",
      sourceDateEpoch: 1_700_000_000,
    })).toThrow(".:request: expected declaration signature from stable release manifest; observed missing");
  });

  it("parses build arguments and writes rendered files to the selected directory", async () => {
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
    const rendered = await buildDocumentation([
      "--source-date-epoch", "1700000000",
      "--root", fixtureRoot,
      "--tarball", tarball,
      "--output", output,
    ]);

    expect(await readFile(path.join(output, "manifest.json"), "utf8")).toBe(
      rendered.get("manifest.json"),
    );
    expect(await readFile(path.join(output, "reference/index.md"), "utf8")).toContain(
      "createRuntimeClient<TInput>",
    );
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

import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { loadContracts } from "../../scripts/docs/contracts.mjs";
import {
  renderDocumentation,
  subpathSlug,
  validateRenderedDocumentation,
} from "../../scripts/docs/render.mjs";

const root = path.resolve(".");
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

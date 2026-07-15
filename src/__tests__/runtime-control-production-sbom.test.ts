import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDirectDependencyCompleteness,
  createProductionSbom,
  generateProductionSbom,
} from "../../scripts/runtime-control/generate-production-sbom.mjs";

describe("runtime-control production SBOM", () => {
  it("sorts every resolved production package and preserves dependency edges", () => {
    const sbom = createProductionSbom([{
      name: "z-root",
      version: "1.0.0",
      dependencies: {
        zebra: { version: "2.0.0", dependencies: { alpha: { version: "3.0.0" } } },
        alpha: { version: "3.0.0" },
      },
    }]);

    expect(sbom.components.map((component) => component.name)).toEqual(["alpha", "z-root", "zebra"]);
    expect(sbom.components.map((component) => component.purl)).toEqual([
      "pkg:npm/alpha@3.0.0",
      "pkg:npm/z-root@1.0.0",
      "pkg:npm/zebra@2.0.0",
    ]);
    expect(sbom.dependencies).toEqual([
      { ref: "pkg:npm/alpha@3.0.0", dependsOn: [] },
      { ref: "pkg:npm/z-root@1.0.0", dependsOn: ["pkg:npm/alpha@3.0.0", "pkg:npm/zebra@2.0.0"] },
      { ref: "pkg:npm/zebra@2.0.0", dependsOn: ["pkg:npm/alpha@3.0.0"] },
    ]);
    expect(sbom.metadata.component.name).toBe("z-root");
    expect(sbom.metadata.component.purl).toBe("pkg:npm/z-root@1.0.0");
    expect(JSON.stringify(sbom)).not.toMatch(/(?:\/Volumes\/|\/Users\/|secret|token)/iu);
  });

  it("requires declared direct dependencies to be direct children of the root", () => {
    const root = {
      name: "root",
      version: "1.0.0",
      dependencies: {
        bridge: { version: "1.0.0", dependencies: { hidden: { version: "2.0.0" } } },
      },
    };
    expect(() => assertDirectDependencyCompleteness(root, ["bridge", "hidden"])).toThrow(/hidden/u);
    expect(assertDirectDependencyCompleteness(root, ["bridge"])).toEqual(["bridge"]);
  });

  it("rejects an empty or unresolved production graph", () => {
    expect(() => createProductionSbom([])).toThrow(/nonempty/u);
    expect(() => createProductionSbom([{ name: "root" }])).toThrow(/resolved name and version/u);
  });

  it("generates identical complete SBOMs from the installed pnpm production graph", () => {
    const first = mkdtempSync(path.join(tmpdir(), "runtime-control-sbom-a-"));
    const second = mkdtempSync(path.join(tmpdir(), "runtime-control-sbom-b-"));
    try {
      const firstResult = generateProductionSbom(path.join(first, "production.cdx.json"));
      const secondResult = generateProductionSbom(path.join(second, "production.cdx.json"));
      const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
      const direct = Object.keys({
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.optionalDependencies ?? {}),
      }).sort();
      expect(readFileSync(firstResult.path, "utf8")).toBe(readFileSync(secondResult.path, "utf8"));
      expect(firstResult.componentCount).toBeGreaterThan(0);
      expect(firstResult.directDependencies).toEqual(direct);
      expect(firstResult.includedDirectDependencies).toEqual(direct);
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });
});

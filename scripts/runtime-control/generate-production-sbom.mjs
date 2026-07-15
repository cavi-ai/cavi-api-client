import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function purl(name, version) {
  return `pkg:npm/${name.startsWith("@") ? `%40${name.slice(1)}` : name}@${version}`;
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

export function createProductionSbom(roots) {
  if (!Array.isArray(roots) || roots.length === 0) throw new Error("production dependency graph must be nonempty");
  const components = new Map();
  const edges = new Map();

  function visit(node) {
    if (!node || typeof node.name !== "string" || typeof node.version !== "string") {
      throw new Error("every production dependency must have a resolved name and version");
    }
    const ref = purl(node.name, node.version);
    components.set(ref, { "bom-ref": ref, name: node.name, purl: ref, type: "library", version: node.version });
    const children = Object.entries(node.dependencies ?? {}).map(([dependencyName, dependency]) => ({
      ...dependency,
      name: dependency.name ?? dependencyName,
    }));
    const childRefs = children.map((child) => purl(child.name, child.version)).sort();
    edges.set(ref, [...new Set([...(edges.get(ref) ?? []), ...childRefs])].sort());
    for (const child of children) visit(child);
  }
  for (const root of roots) visit(root);

  const orderedComponents = [...components.values()].sort((left, right) => left.purl.localeCompare(right.purl));
  const rootRef = purl(roots[0].name, roots[0].version);
  const dependencies = [...components.keys()].sort().map((ref) => ({ dependsOn: edges.get(ref) ?? [], ref }));
  return sorted({
    bomFormat: "CycloneDX",
    components: orderedComponents,
    dependencies,
    metadata: { component: components.get(rootRef) },
    specVersion: "1.5",
    version: 1,
  });
}

export function assertDirectDependencyCompleteness(root, declaredDirectDependencies) {
  const rootChildren = new Set(Object.keys(root.dependencies ?? {}));
  const missing = declaredDirectDependencies.filter((name) => !rootChildren.has(name));
  if (missing.length > 0) throw new Error(`pnpm root production graph omitted direct dependencies: ${missing.join(", ")}`);
  return declaredDirectDependencies.filter((name) => rootChildren.has(name)).sort();
}

export function generateProductionSbom(outputPath) {
  const graph = JSON.parse(execFileSync("pnpm", ["list", "--prod", "--json", "--depth", "Infinity"], {
    cwd: packageRoot,
    encoding: "utf8",
  }));
  const sbom = createProductionSbom(graph);
  const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const directDependencies = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) }).sort();
  const includedDirectDependencies = assertDirectDependencyCompleteness(graph[0], directDependencies);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`);
  return { componentCount: sbom.components.length, directDependencies, includedDirectDependencies, path: outputPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2] ?? path.join(packageRoot, ".artifacts/runtime-control/production.cdx.json");
  console.log(JSON.stringify(generateProductionSbom(path.resolve(output)), null, 2));
}

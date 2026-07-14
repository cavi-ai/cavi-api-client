import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const srcRoot = path.join(packageRoot, "src");
const caviEntry = path.join(srcRoot, "extensions", "cavi", "index.ts");
const ownershipDoc = path.join(packageRoot, "docs", "extension-ownership.md");
const dependencyFormsFixture = path.join(
  srcRoot,
  "__tests__",
  "fixtures",
  "extension-ownership",
  "dependency-forms.ts.fixture",
);
const mixedAliasesFixture = path.join(
  srcRoot,
  "__tests__",
  "fixtures",
  "extension-ownership",
  "mixed-aliases.ts.fixture",
);
const providerExtensionImportAllowlist = new Set([
  "src/providers/hermes/team-registry.ts",
  "src/providers/hermes/team-registry-config.ts",
  "src/providers/openclaw/team-registry.ts",
  "src/providers/openclaw/team-registry-config.ts",
]);
const tsConfig = ts.readConfigFile(path.join(packageRoot, "tsconfig.json"), ts.sys.readFile);
const parsedTsConfig = ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, packageRoot);

function walk(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relative(filePath: string): string {
  return path.relative(packageRoot, filePath).split(path.sep).join("/");
}

function sourceImports(filePath: string): string[] {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: string[] = [];
  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteral(node.moduleReference.expression)) {
      imports.push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

function resolveDependency(containingFile: string, specifier: string): string | undefined {
  return ts.resolveModuleName(
    specifier,
    containingFile,
    parsedTsConfig.options,
    ts.sys,
  ).resolvedModule?.resolvedFileName;
}

type ImplementationOwner = "core" | "cavi";

function implementationOwner(filePath: string): ImplementationOwner | undefined {
  const relativePath = relative(filePath);
  if (relativePath.startsWith("src/core/") || relativePath.startsWith("src/contracts/")) {
    return "core";
  }
  return relativePath.startsWith("src/extensions/cavi/") ? "cavi" : undefined;
}

function implementationConcern(filePath: string, owner: ImplementationOwner): string {
  const relativePath = relative(filePath);
  if (/\/transports?\.tsx?$/u.test(relativePath)) return "transport";
  if (/\/snapshots?\.tsx?$/u.test(relativePath)) return "snapshot";
  const ownerRelative = owner === "core"
    ? relativePath.replace(/^src\/(?:core|contracts)\//u, "")
    : relativePath.replace(/^src\/extensions\/cavi\//u, "");
  return ownerRelative.replace(/\.(?:d\.)?[cm]?[jt]sx?$/u, "");
}

function resolvedOwnerTargets(
  containingFile: string,
  visited = new Set<string>(),
): Array<{ concern: string; owner: ImplementationOwner }> {
  if (visited.has(containingFile)) return [];
  visited.add(containingFile);
  return sourceImports(containingFile).flatMap((specifier) => {
    const resolved = resolveDependency(containingFile, specifier);
    if (!resolved || !resolved.startsWith(srcRoot)) return [];
    const owner = implementationOwner(resolved);
    if (owner) {
      return [{
        concern: implementationConcern(resolved, owner),
        owner,
      }];
    }
    return resolvedOwnerTargets(resolved, visited);
  });
}

function hasMixedCoreCaviConcern(filePath: string): boolean {
  const ownersByConcern = new Map<string, Set<ImplementationOwner>>();
  for (const target of resolvedOwnerTargets(filePath)) {
    const owners = ownersByConcern.get(target.concern) ?? new Set<ImplementationOwner>();
    owners.add(target.owner);
    ownersByConcern.set(target.concern, owners);
  }
  return [...ownersByConcern.values()].some((owners) =>
    owners.has("core") && owners.has("cavi"));
}

type PublicExportOwner = "core/contracts" | "CAVI extension";

interface PublicCaviExport {
  symbol: string;
  actualOwner: PublicExportOwner;
}

let publicCaviExportCache: PublicCaviExport[] | undefined;

function publicExportOwner(symbol: ts.Symbol, checker: ts.TypeChecker): PublicExportOwner {
  const resolved = symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
  const declarationOwners = new Set((resolved.declarations ?? symbol.declarations ?? []).map(
    (declaration) => {
      const declarationPath = relative(declaration.getSourceFile().fileName);
      if (declarationPath.startsWith("src/core/")
        || declarationPath.startsWith("src/contracts/")) return "core/contracts";
      if (declarationPath.startsWith("src/extensions/cavi/")) return "CAVI extension";
      throw new Error(
        `Unsupported CAVI export owner for ${symbol.name}: ${declarationPath}`,
      );
    },
  ));
  if (declarationOwners.size !== 1) {
    throw new Error(
      `Ambiguous CAVI export owner for ${symbol.name}: ${[...declarationOwners].sort().join(", ")}`,
    );
  }
  return [...declarationOwners][0] as PublicExportOwner;
}

function publicCaviExports(): PublicCaviExport[] {
  if (publicCaviExportCache) return publicCaviExportCache;
  const program = ts.createProgram(parsedTsConfig.fileNames, parsedTsConfig.options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(caviEntry);
  if (!source) throw new Error("CAVI public entry was not included in the TypeScript program");
  const module = checker.getSymbolAtLocation(source);
  if (!module) throw new Error("CAVI public entry has no module symbol");
  publicCaviExportCache = checker.getExportsOfModule(module)
    .map((symbol) => ({
      symbol: symbol.name,
      actualOwner: publicExportOwner(symbol, checker),
    }))
    .sort((left, right) => left.symbol < right.symbol ? -1 : left.symbol > right.symbol ? 1 : 0);
  return publicCaviExportCache;
}

function classifiedSymbols(markdown = existsSync(ownershipDoc)
  ? readFileSync(ownershipDoc, "utf8")
  : ""): string[] {
  const allowedClassifications = new Set([
    "keep",
    "already-core",
    "promote-now",
    "compatibility-exception",
    "retire-later",
  ]);
  const expectedOwners = new Map([
    ["keep", "CAVI extension"],
    ["already-core", "core/contracts"],
    ["promote-now", "core/contracts"],
    ["compatibility-exception", "Provider compatibility facade"],
    ["retire-later", "CAVI extension"],
  ]);
  const rows = markdown
    .split("## Provider forwarding compatibility exceptions")[0]
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const valid = rows.every((cells) => {
    if (cells.length !== 5) return false;
    const [symbol, owner, classification, evidence, action] = cells;
    if (!/^`[^`]+`$/u.test(symbol) || !owner || !evidence || !action) return false;
    if (!allowedClassifications.has(classification)) return false;
    const expectedOwner = expectedOwners.get(classification);
    return !expectedOwner || owner === expectedOwner;
  });
  const symbols = rows.map(([symbol]) => symbol.replaceAll("`", ""));
  const actualExports = new Map(publicCaviExports().map((entry) => [entry.symbol, entry.actualOwner]));
  const matchesActualOwners = rows.every(([symbolCell, owner, classification]) => {
    const actualOwner = actualExports.get(symbolCell.replaceAll("`", ""));
    if (!actualOwner || owner !== actualOwner) return false;
    return actualOwner === "core/contracts"
      ? classification === "already-core" || classification === "promote-now"
      : classification === "keep" || classification === "retire-later";
  });
  if (!valid || !matchesActualOwners || new Set(symbols).size !== symbols.length) return [];
  return symbols.sort();
}

function compatibilityExceptionModules(markdown = readFileSync(ownershipDoc, "utf8")): string[] {
  const rows = markdown
    .split("## Provider forwarding compatibility exceptions")[1]
    ?.split("## Dependency direction")[0]
    .split("\n")
    .filter((line) => /^\| `src\/providers\/[^`]+` \|/u.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim())) ?? [];
  const valid = rows.every((cells) => cells.length === 5
    && /^`src\/providers\/[^`]+`$/u.test(cells[0])
    && cells[1] === "Provider compatibility facade"
    && cells[2] === "compatibility-exception"
    && Boolean(cells[3])
    && Boolean(cells[4]));
  const modules = rows.map(([module]) => module.replaceAll("`", ""));
  if (!valid || new Set(modules).size !== modules.length) return [];
  return modules.sort();
}

describe("CAVI extension ownership", () => {
  it("classifies every public CAVI export exactly once", () => {
    expect(classifiedSymbols()).toEqual(publicCaviExports().map(({ symbol }) => symbol));
  }, 15_000); // TypeScript export ownership analysis is compiler-heavy under V8 coverage instrumentation.

  it("rejects classification rows with invalid or incomplete metadata", () => {
    const markdown = readFileSync(ownershipDoc, "utf8");
    const malformed = [
      markdown.replace("| CAVI extension | keep |", "| CAVI extension | invented |"),
      markdown.replace("| CAVI extension | keep |", "| core/contracts | keep |"),
      markdown.replace("| CAVI extension | keep |", "| keep |"),
      markdown.replace(/\| Declared by [^|]+ \| Keep implementation/u, "|  | Keep implementation"),
      markdown.replace(/\| Keep implementation and evolution under the CAVI extension\. \|/u, "|  |"),
    ];

    for (const candidate of malformed) {
      expect(classifiedSymbols(candidate)).not.toEqual(
        publicCaviExports().map(({ symbol }) => symbol),
      );
    }
  });

  it("rejects a textually consistent classification that contradicts the compiler owner", () => {
    const markdown = readFileSync(ownershipDoc, "utf8");
    const mislabeled = markdown.replace(
      "| `appendHttpQuery` | core/contracts | already-core |",
      "| `appendHttpQuery` | CAVI extension | keep |",
    );

    expect(mislabeled).not.toBe(markdown);
    expect(classifiedSymbols(mislabeled)).not.toEqual(
      publicCaviExports().map(({ symbol }) => symbol),
    );
  });

  it("validates every compatibility-exception column and the exact allowlist", () => {
    const markdown = readFileSync(ownershipDoc, "utf8");
    expect(compatibilityExceptionModules(markdown)).toEqual(
      [...providerExtensionImportAllowlist].sort(),
    );
    const malformed = markdown.replace(
      "| Provider compatibility facade | compatibility-exception |",
      "| Provider compatibility facade | invented |",
    );
    expect(compatibilityExceptionModules(malformed)).toEqual([]);
  });

  it("discovers every supported TypeScript and JavaScript dependency form", () => {
    expect(sourceImports(dependencyFormsFixture)).toEqual([
      "../../../core/http/index.js",
      "../../../extensions/cavi/index.js",
      "../../../extensions/cavi/client.js",
      "../../../core/runtime/control-plane/contracts.js",
      "../../../extensions/cavi/discourse/contracts.js",
    ]);
  });

  it("resolves barrel aliases before comparing core and CAVI concerns", () => {
    expect(hasMixedCoreCaviConcern(mixedAliasesFixture)).toBe(true);
  });

  it("keeps core below extensions and limits provider compatibility imports", () => {
    const productionFiles = walk(srcRoot)
      .filter((filePath) => /\.[cm]?[jt]sx?$/u.test(filePath))
      .filter((filePath) => !relative(filePath).includes("/__tests__/"))
      .filter((filePath) => !statSync(filePath).isDirectory());
    const providerExtensionImports = productionFiles
      .filter((filePath) => relative(filePath).startsWith("src/providers/"))
      .filter((filePath) => sourceImports(filePath).some((specifier) => {
        const resolved = resolveDependency(filePath, specifier);
        return resolved ? implementationOwner(resolved) === "cavi" : false;
      }))
      .map(relative);
    const unapprovedProviderExtensionImports = providerExtensionImports
      .filter((filePath) => !providerExtensionImportAllowlist.has(filePath));
    const coreExtensionImports = productionFiles
      .filter((filePath) => relative(filePath).startsWith("src/core/")
        || relative(filePath).startsWith("src/contracts/"))
      .filter((filePath) => sourceImports(filePath).some((specifier) => {
        const resolved = resolveDependency(filePath, specifier);
        return resolved ? implementationOwner(resolved) === "cavi" : false;
      }))
      .map(relative);

    expect(unapprovedProviderExtensionImports).toEqual([]);
    expect(coreExtensionImports).toEqual([]);
  });

  it("does not mix core and CAVI implementations for the same concern", () => {
    const offenders = walk(srcRoot)
      .filter((filePath) => /\.[cm]?[jt]sx?$/u.test(filePath))
      .filter((filePath) => !relative(filePath).includes("/__tests__/"))
      .filter(hasMixedCoreCaviConcern)
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

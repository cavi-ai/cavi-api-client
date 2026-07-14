import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const srcRoot = path.join(packageRoot, "src");
const caviEntry = path.join(srcRoot, "extensions", "cavi", "index.ts");
const ownershipDoc = path.join(packageRoot, "docs", "extension-ownership.md");
const providerExtensionImportAllowlist = new Set([
  "src/providers/hermes/team-registry.ts",
  "src/providers/hermes/team-registry-config.ts",
  "src/providers/openclaw/team-registry.ts",
  "src/providers/openclaw/team-registry-config.ts",
]);

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
  return source.statements.flatMap((statement) => {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
      && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      return [statement.moduleSpecifier.text];
    }
    return [];
  });
}

function publicCaviExports(): string[] {
  const config = ts.readConfigFile(path.join(packageRoot, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, packageRoot);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(caviEntry);
  if (!source) throw new Error("CAVI public entry was not included in the TypeScript program");
  const module = checker.getSymbolAtLocation(source);
  if (!module) throw new Error("CAVI public entry has no module symbol");
  return checker.getExportsOfModule(module).map((symbol) => symbol.name).sort();
}

function classifiedSymbols(): string[] {
  if (!existsSync(ownershipDoc)) return [];
  return readFileSync(ownershipDoc, "utf8")
    .split("## Provider forwarding compatibility exceptions")[0]
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1]?.trim().replaceAll("`", "") ?? "")
    .filter(Boolean)
    .sort();
}

describe("CAVI extension ownership", () => {
  it("classifies every public CAVI export exactly once", () => {
    expect(classifiedSymbols()).toEqual(publicCaviExports());
  });

  it("keeps core below extensions and limits provider compatibility imports", () => {
    const productionFiles = walk(srcRoot)
      .filter((filePath) => /\.tsx?$/u.test(filePath))
      .filter((filePath) => !relative(filePath).includes("/__tests__/"))
      .filter((filePath) => !statSync(filePath).isDirectory());
    const providerExtensionImports = productionFiles
      .filter((filePath) => relative(filePath).startsWith("src/providers/"))
      .filter((filePath) => sourceImports(filePath).some((specifier) => specifier.includes("extensions/cavi")))
      .map(relative);
    const unapprovedProviderExtensionImports = providerExtensionImports
      .filter((filePath) => !providerExtensionImportAllowlist.has(filePath));
    const coreExtensionImports = productionFiles
      .filter((filePath) => relative(filePath).startsWith("src/core/"))
      .filter((filePath) => sourceImports(filePath).some((specifier) => specifier.includes("extensions/cavi")))
      .map(relative);

    expect(unapprovedProviderExtensionImports).toEqual([]);
    expect(coreExtensionImports).toEqual([]);
  });

  it("does not mix core and CAVI implementations for the same concern", () => {
    const offenders = walk(srcRoot)
      .filter((filePath) => /\.tsx?$/u.test(filePath))
      .filter((filePath) => !relative(filePath).includes("/__tests__/"))
      .filter((filePath) => {
        const imports = sourceImports(filePath);
        const coreConcerns = new Set(imports
          .filter((specifier) => specifier.includes("/core/"))
          .map((specifier) => path.basename(specifier).replace(/\.(?:js|ts)$/u, "")));
        return imports
          .filter((specifier) => specifier.includes("extensions/cavi"))
          .some((specifier) => coreConcerns.has(path.basename(specifier).replace(/\.(?:js|ts)$/u, "")));
      })
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

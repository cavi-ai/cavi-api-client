import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ts from "typescript";

import { APPROVED_RELEASE_SHA256, DOCUMENTED_PACKAGE, DOCUMENTED_VERSION } from "./types.mjs";

const execFileAsync = promisify(execFile);

/** @param {ts.Declaration} declaration */
function declarationKind(declaration) {
  if (ts.isInterfaceDeclaration(declaration)) return "interface";
  if (ts.isTypeAliasDeclaration(declaration)) return "type";
  if (ts.isClassDeclaration(declaration)) return "class";
  if (ts.isFunctionDeclaration(declaration)) return "function";
  if (ts.isEnumDeclaration(declaration)) return "enum";
  if (ts.isVariableDeclaration(declaration)) return "variable";
  if (ts.isModuleDeclaration(declaration)) return "namespace";
  return ts.SyntaxKind[declaration.kind].replace(/Declaration$/u, "").toLowerCase();
}

const declarationPrinter = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
  removeComments: false,
});

/** @param {ts.Declaration} declaration */
function printableDeclaration(declaration) {
  return ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent)
    ? declaration.parent.parent
    : declaration;
}

/** @param {readonly ts.Declaration[]} declarations */
function declarationSignature(declarations) {
  return declarations.map((declaration) => {
    const node = printableDeclaration(declaration);
    return declarationPrinter.printNode(
      ts.EmitHint.Unspecified,
      node,
      node.getSourceFile(),
    ).trim();
  }).join("\n");
}

/**
 * @param {import("./types.mjs").ReleaseExport} left
 * @param {import("./types.mjs").ReleaseExport} right
 */
function compareExports(left, right) {
  return left.subpath.localeCompare(right.subpath);
}

/**
 * @param {import("./types.mjs").ReleaseSymbol} left
 * @param {import("./types.mjs").ReleaseSymbol} right
 */
function compareSymbols(left, right) {
  return (
    left.subpath.localeCompare(right.subpath) ||
    left.name.localeCompare(right.name) ||
    left.kind.localeCompare(right.kind)
  );
}

/**
 * @param {unknown} target
 * @returns {string | undefined}
 */
function resolveTypesTarget(target) {
  if (Array.isArray(target)) {
    for (const candidate of target) {
      const types = resolveTypesTarget(candidate);
      if (types) return types;
    }
    return undefined;
  }
  if (!target || typeof target !== "object") return undefined;

  const conditions = /** @type {Record<string, unknown>} */ (target);
  if (typeof conditions.types === "string") return conditions.types;
  if (conditions.types && typeof conditions.types === "object") {
    const types = resolveTypesTarget(conditions.types);
    if (types) return types;
  }

  for (const [condition, candidate] of Object.entries(conditions)) {
    if (condition === "types" || condition === "." || condition.startsWith("./")) {
      continue;
    }
    const types = resolveTypesTarget(candidate);
    if (types) return types;
  }
  return undefined;
}

/**
 * @param {unknown} exportsField
 * @returns {import("./types.mjs").ReleaseExport[]}
 */
function normalizePublicExports(exportsField) {
  if (!exportsField || typeof exportsField !== "object") return [];

  const exportsMap = /** @type {Record<string, unknown>} */ (exportsField);
  const publicSubpaths = Object.keys(exportsMap).filter(
    (key) => key === "." || key.startsWith("./"),
  );
  /** @type {[string, unknown][]} */
  const entries = publicSubpaths.length
    ? publicSubpaths.map((subpath) => [subpath, exportsMap[subpath]])
    : [[".", exportsField]];

  return entries.map(([subpath, target]) => {
    const types = resolveTypesTarget(target);
    if (types) return { subpath, kind: "declaration", types };
    if (typeof target === "string") return { subpath, kind: "asset", target };
    throw new Error(`${subpath}: unsupported public export without a declaration or asset target`);
  });
}

/**
 * Inspect the public TypeScript surface of a stable package tarball.
 *
 * @param {string} tgzPath
 * @returns {Promise<import("./types.mjs").ReleaseManifest>}
 */
export async function inspectRelease(tgzPath, options = {}) {
  const archive = await readFile(tgzPath);
  const sha256 = createHash("sha256").update(archive).digest("hex");
  const expectedSha256 = options.expectedSha256 ?? APPROVED_RELEASE_SHA256;
  if (sha256 !== expectedSha256) {
    throw new Error(`stable artifact digest mismatch: expected sha256:${expectedSha256}, observed sha256:${sha256}`);
  }
  const { stdout: archiveListing } = await execFileAsync("tar", ["-tzf", tgzPath]);
  for (const rawEntry of archiveListing.split("\n").filter(Boolean)) {
    const entry = rawEntry.endsWith("/") ? rawEntry.slice(0, -1) : rawEntry;
    if (path.posix.isAbsolute(entry) || entry.split("/").some((segment) => segment === "." || segment === "..") || (entry !== "package" && !entry.startsWith("package/"))) {
      throw new Error(`archive entry escapes package root: ${rawEntry}`);
    }
  }
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "cavi-docs-release-inspector-"),
  );

  try {
    await execFileAsync("tar", ["-xzf", tgzPath, "-C", temporaryDirectory]);
    const packageDirectory = path.join(temporaryDirectory, "package");
    const resolvedPackageDirectory = await realpath(packageDirectory);
    const pkg = JSON.parse(
      await readFile(path.join(packageDirectory, "package.json"), "utf8"),
    );

    if (pkg.name !== DOCUMENTED_PACKAGE || pkg.version !== DOCUMENTED_VERSION) {
      throw new Error(
        `release mismatch: expected ${DOCUMENTED_PACKAGE}@${DOCUMENTED_VERSION}, observed ${pkg.name}@${pkg.version}`,
      );
    }

    const releaseExports = normalizePublicExports(pkg.exports).sort(compareExports);

    /** @type {Map<string, string>} */
    const declarationPaths = new Map();
    for (const releaseExport of releaseExports) {
      if (releaseExport.kind !== "declaration") continue;
      const declarationPath = path.resolve(packageDirectory, releaseExport.types);
      const relativePath = path.relative(packageDirectory, declarationPath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(
          `declaration target escapes package: ${releaseExport.types}`,
        );
      }
      let declarationStat;
      let resolvedDeclarationPath;
      try {
        declarationStat = await lstat(declarationPath);
        resolvedDeclarationPath = await realpath(declarationPath);
      } catch {
        throw new Error(`missing declaration: ${releaseExport.types}`);
      }
      const resolvedRelativePath = path.relative(
        resolvedPackageDirectory,
        resolvedDeclarationPath,
      );
      if (
        declarationStat.isSymbolicLink() ||
        resolvedRelativePath.startsWith("..") ||
        path.isAbsolute(resolvedRelativePath)
      ) {
        throw new Error(
          `declaration target escapes package: ${releaseExport.types}`,
        );
      }
      if (!declarationStat.isFile()) {
        throw new Error(`missing declaration: ${releaseExport.types}`);
      }
      declarationPaths.set(releaseExport.subpath, resolvedDeclarationPath);
    }

    for (const releaseExport of releaseExports) {
      if (releaseExport.kind !== "asset") continue;
      const assetPath = path.resolve(packageDirectory, releaseExport.target);
      const relativePath = path.relative(packageDirectory, assetPath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`asset target escapes package: ${releaseExport.target}`);
      }
      let assetStat;
      let resolvedAssetPath;
      try {
        assetStat = await lstat(assetPath);
        resolvedAssetPath = await realpath(assetPath);
      } catch {
        throw new Error(`missing asset: ${releaseExport.target}`);
      }
      const resolvedRelativePath = path.relative(resolvedPackageDirectory, resolvedAssetPath);
      if (assetStat.isSymbolicLink() || resolvedRelativePath.startsWith("..") || path.isAbsolute(resolvedRelativePath)) {
        throw new Error(`asset target escapes package: ${releaseExport.target}`);
      }
      if (!assetStat.isFile()) throw new Error(`missing asset: ${releaseExport.target}`);
    }

    const program = ts.createProgram([...declarationPaths.values()], {
      allowJs: false,
      noEmit: true,
      skipLibCheck: true,
    });
    const checker = program.getTypeChecker();
    /** @type {import("./types.mjs").ReleaseSymbol[]} */
    const symbols = [];

    for (const [subpath, declarationPath] of declarationPaths) {
      const sourceFile = program.getSourceFile(declarationPath);
      const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
      if (!moduleSymbol) continue;

      for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
        const symbol =
          exportedSymbol.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exportedSymbol)
            : exportedSymbol;
        const declarations = symbol.declarations ?? exportedSymbol.declarations;
        const declaration = declarations?.[0];
        if (!declaration) continue;
        symbols.push({
          subpath,
          name: exportedSymbol.getName(),
          kind: declarationKind(declaration),
          signature: declarationSignature(declarations),
        });
      }
    }

    return {
      package: pkg.name,
      version: pkg.version,
      sha256,
      exports: releaseExports,
      symbols: symbols.sort(compareSymbols),
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

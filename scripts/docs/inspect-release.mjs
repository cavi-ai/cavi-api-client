import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ts from "typescript";

import { DOCUMENTED_PACKAGE, DOCUMENTED_VERSION } from "./types.mjs";

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

/**
 * @param {import("./types.mjs").ReleaseExport} left
 * @param {import("./types.mjs").ReleaseExport} right
 */
function compareExports(left, right) {
  return left.subpath.localeCompare(right.subpath) || left.types.localeCompare(right.types);
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
 * Inspect the public TypeScript surface of a stable package tarball.
 *
 * @param {string} tgzPath
 * @returns {Promise<import("./types.mjs").ReleaseManifest>}
 */
export async function inspectRelease(tgzPath) {
  const archive = await readFile(tgzPath);
  const sha256 = createHash("sha256").update(archive).digest("hex");
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "cavi-docs-release-inspector-"),
  );

  try {
    await execFileAsync("tar", ["-xzf", tgzPath, "-C", temporaryDirectory]);
    const packageDirectory = path.join(temporaryDirectory, "package");
    const pkg = JSON.parse(
      await readFile(path.join(packageDirectory, "package.json"), "utf8"),
    );

    if (pkg.name !== DOCUMENTED_PACKAGE || pkg.version !== DOCUMENTED_VERSION) {
      throw new Error(
        `release mismatch: expected ${DOCUMENTED_PACKAGE}@${DOCUMENTED_VERSION}, observed ${pkg.name}@${pkg.version}`,
      );
    }

    const releaseExports = Object.entries(pkg.exports ?? {})
      .flatMap(([subpath, target]) =>
        target && typeof target === "object" && typeof target.types === "string"
          ? [{ subpath, types: target.types }]
          : [],
      )
      .sort(compareExports);

    /** @type {Map<string, string>} */
    const declarationPaths = new Map();
    for (const releaseExport of releaseExports) {
      const declarationPath = path.resolve(packageDirectory, releaseExport.types);
      const relativePath = path.relative(packageDirectory, declarationPath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(
          `declaration target escapes package: ${releaseExport.types}`,
        );
      }
      try {
        const declarationStat = await stat(declarationPath);
        if (!declarationStat.isFile()) throw new Error("not a file");
      } catch {
        throw new Error(`missing declaration: ${releaseExport.types}`);
      }
      declarationPaths.set(releaseExport.subpath, declarationPath);
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
        const declaration = symbol.declarations?.[0] ?? exportedSymbol.declarations?.[0];
        if (!declaration) continue;
        symbols.push({
          subpath,
          name: exportedSymbol.getName(),
          kind: declarationKind(declaration),
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

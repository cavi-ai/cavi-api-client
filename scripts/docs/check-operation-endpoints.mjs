#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OPERATIONS_DIR = path.join(ROOT, "docs/api-client/source/pages/operations");
const OWNER_PATHS_GLOBS = [
  "src/contracts/paths.ts",
  "src/extensions/cavi/contracts/paths.ts",
  "src/providers/claude/paths.ts",
  "src/providers/claude/managed-agents/paths.ts",
  "src/providers/codex/paths.ts",
  "src/providers/agy/paths.ts",
  "src/providers/opencode/paths.ts",
];

function* httpTokens(markdown) {
  let inHttp = false;
  let inCode = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) { inCode = !inCode; inHttp = false; continue; }
    if (inCode) continue;
    if (line.startsWith("**HTTP**")) inHttp = true;
    else if (!line.trim() || /^(?:#{1,6}\s|\*\*)/u.test(line)) inHttp = false;
    if (!inHttp) continue;
    for (const match of line.matchAll(/`([^`]+)`/gu)) yield match[1];
  }
}

/** Extract owner-checkable static prefixes, including wrapped HTTP lines. */
export function extractHttpPaths(markdown) {
  const paths = [];
  for (const token of httpTokens(markdown)) {
    const found = token.match(/\s(\/[^\s?]+)/u) ?? token.match(/^(\/[^\s?]+)/u);
    if (!found) continue; // skips "n/a (…)" and RPC prose
    const segments = found[1].split("/").filter(Boolean);
    const staticSegments = [];
    for (const segment of segments) {
      if (segment.startsWith(":")) break;
      staticSegments.push(segment);
    }
    if (staticSegments.length) paths.push(`/${staticSegments.join("/")}`);
  }
  return [...new Set(paths)];
}

/** Preserve verbs and full route shapes; ignore explicitly non-HTTP operations. */
export function extractHttpOperations(markdown) {
  const operations = [];
  for (const token of httpTokens(markdown)) {
    const match = token.match(/^([A-Z]+)\s+(\/[^\s]+)$/u);
    if (match) operations.push({ method: match[1], path: match[2] });
    else if (token.includes("/") && !token.startsWith("n/a")) throw new Error(`malformed HTTP operation: ${token}`);
  }
  return operations;
}

// A safe symbolic ID accepted by every provider, including OpenCode's ses_ prefix.
const PARAMETER = "ses_docs_parameter";
function routeShape(route) {
  return route.split("?", 1)[0].replace(/\/:[A-Za-z_][A-Za-z\d_]*(?=[:/]|$)/gu, `/${PARAMETER}`);
}

/** Derive method/path pairs from transport calls, using the actual built path resolvers. */
export function extractSourceHttpOperations(source, routes) {
  const file = ts.createSourceFile("provider.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const bindings = new Map();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.moduleSpecifier.text.endsWith("/paths.js")) continue;
    const imports = statement.importClause?.namedBindings;
    if (imports && ts.isNamedImports(imports)) {
      for (const item of imports.elements) bindings.set(item.name.text, item.propertyName?.text ?? item.name.text);
    }
  }
  const resolving = new Set();
  function resolve(node) {
    if (!node || resolving.has(node)) return undefined;
    resolving.add(node);
    try {
      if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return resolve(node.expression);
      if (ts.isStringLiteral(node)) return node.text;
      if (ts.isIdentifier(node)) {
        for (let scope = node.parent; scope; scope = scope.parent) {
          if (ts.isFunctionLike(scope) && scope.parameters.some((parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === node.text)) return undefined;
          if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) continue;
          for (const statement of scope.statements) {
            if (!ts.isVariableStatement(statement) || statement.pos >= node.pos) continue;
            for (const declaration of statement.declarationList.declarations) {
              if (ts.isIdentifier(declaration.name) && declaration.name.text === node.text) return resolve(declaration.initializer);
            }
          }
        }
        return bindings.has(node.text) ? routes[bindings.get(node.text)] : undefined;
      }
      if (ts.isPropertyAccessExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text === "scope") return { directory: "/docs-verification", workspace: "docs-verification" };
        const object = resolve(node.expression);
        return object && typeof object === "object" ? object[node.name.text] : undefined;
      }
      if (ts.isConditionalExpression(node)) {
        const left = resolve(node.whenTrue);
        const right = resolve(node.whenFalse);
        if (typeof left === "string" && typeof right === "string" && routeShape(left) === routeShape(right)) return left;
        throw new Error(`ambiguous provider route: ${node.getText(file)}`);
      }
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression) && bindings.get(node.expression.text) === "appendHttpQuery") return resolve(node.arguments[0]);
        const resolver = resolve(node.expression);
        if (typeof resolver !== "function") return undefined;
        return resolver(...node.arguments.map((argument) => {
          if (ts.isPropertyAccessExpression(argument) && argument.expression.kind === ts.SyntaxKind.ThisKeyword && argument.name.text === "scope") return resolve(argument);
          return PARAMETER;
        }));
      }
      return undefined;
    } finally {
      resolving.delete(node);
    }
  }
  const operations = new Map();
  function mayOverrideMethod(node) {
    if (ts.isParenthesizedExpression(node)) return mayOverrideMethod(node.expression);
    if (ts.isConditionalExpression(node)) return mayOverrideMethod(node.whenTrue) || mayOverrideMethod(node.whenFalse);
    if (!ts.isObjectLiteralExpression(node)) return true;
    return node.properties.some((property) => ts.isSpreadAssignment(property)
      ? mayOverrideMethod(property.expression)
      : !property.name || ts.isComputedPropertyName(property.name) || property.name.getText(file).replace(/["']/gu, "") === "method");
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
      && ["request", "requestRaw", "requestChecked", "requestWithResponse"].includes(node.expression.name.text)) {
      const route = resolve(node.arguments[0]);
      if (typeof route === "string") {
        const options = node.arguments[1];
        if (options && (!ts.isObjectLiteralExpression(options) || options.properties.some((property) =>
          (property.name && ts.isComputedPropertyName(property.name)) || (ts.isSpreadAssignment(property) && mayOverrideMethod(property.expression))))) throw new Error(`unresolved HTTP options: ${node.getText(file)}`);
        const property = options?.properties.findLast((item) => item.name && item.name.getText(file).replace(/["']/gu, "") === "method");
        const methodNode = property && (ts.isPropertyAssignment(property) ? property.initializer : ts.isShorthandPropertyAssignment(property) ? property.name : undefined);
        const method = property ? resolve(methodNode) : "GET";
        if (!method || !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) throw new Error(`unresolved HTTP method: ${node.getText(file)}`);
        const operation = { method, path: routeShape(route) };
        operations.set(`${method} ${operation.path}`, operation);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...operations.values()];
}

export function findUnknownOperations(documented, implemented) {
  const known = new Set(implemented.map((operation) => `${operation.method} ${routeShape(operation.path)}`));
  return documented.filter((operation) => !known.has(`${operation.method} ${routeShape(operation.path)}`));
}

/**
 * True when a documented static path prefix corresponds to a source literal.
 * Version-prefixed API paths (e.g. provider `/v1/models/...`) are assembled in
 * source from a version constant plus the remainder, so the full prefix is not a
 * contiguous literal — accept those when the version-stripped remainder is.
 */
export function isKnownPath(candidate, corpus) {
  if (corpus.includes(candidate)) return true;
  const segments = candidate.split("/").filter(Boolean);
  if (segments.length > 1 && /^v\d/u.test(segments[0])) {
    return corpus.includes(`/${segments.slice(1).join("/")}`);
  }
  return false;
}

/** Paths with no corresponding literal (direct or version-stripped) in the corpus. */
export function findOrphanPaths(paths, corpus) {
  return paths.filter((candidate) => !isKnownPath(candidate, corpus));
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(full);
      return entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
    }),
  );
  return nested.flat();
}

async function main() {
  const owners = await Promise.all(OWNER_PATHS_GLOBS.map(async (rel) => [rel, await readFile(path.join(ROOT, rel), "utf8")]));
  const corpus = owners.map(([, contents]) => contents).join("\n");
  const providers = {
    "claude-anthropic.md": { directory: "claude", files: ["client.ts"] },
    "claude-managed-agents.md": { directory: "claude/managed-agents", files: ["client.ts"] },
    "codex.md": { directory: "codex", files: ["client.ts", "files.ts"] },
    "agy.md": { directory: "agy", files: ["client.ts"] },
    "opencode.md": { directory: "opencode", files: ["client.ts"] },
  };
  const files = await markdownFiles(OPERATIONS_DIR);
  let orphanTotal = 0;
  for (const file of files) {
    const markdown = await readFile(file, "utf8");
    const isProvider = file.startsWith(path.join(OPERATIONS_DIR, "providers") + path.sep);
    const provider = isProvider ? providers[path.basename(file)] : undefined;
    let orphans;
    if (provider) {
      const routes = await import(pathToFileURL(path.join(ROOT, "dist/providers", provider.directory, "paths.js")).href);
      const implemented = (await Promise.all(provider.files.map(async (name) => extractSourceHttpOperations(await readFile(path.join(ROOT, "src/providers", provider.directory, name), "utf8"), routes)))).flat();
      orphans = findUnknownOperations(extractHttpOperations(markdown), implemented).map((operation) => `${operation.method} ${operation.path}`);
    } else if (isProvider) {
      // RPC-only provider pages have no HTTP routes. New HTTP providers need an owner.
      orphans = extractHttpOperations(markdown).map((operation) => `${operation.method} ${operation.path} (missing provider owner)`);
    } else {
      orphans = findOrphanPaths(extractHttpPaths(markdown), corpus);
    }
    if (orphans.length) {
      orphanTotal += orphans.length;
      console.error(`${path.relative(ROOT, file)}: unknown HTTP operations -> ${orphans.join(", ")}`);
    }
  }
  if (orphanTotal) {
    console.error(`\n${orphanTotal} documented HTTP operation(s) do not match their owning source.`);
    process.exit(1);
  }
  console.log(`check-operation-endpoints: provider method/path checks and remaining path-prefix checks passed (${files.length} pages).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

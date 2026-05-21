import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GatewayApiClient, requireRepoRoot, resolveRepoRoot } from "./index";

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SRC_ROOT = path.join(PACKAGE_ROOT, "src");
const PACKAGE_JSON = path.join(PACKAGE_ROOT, "package.json");
const HARDENING_TEST_PATH = "src/package-hardening.test.ts";

const FORBIDDEN_PACKAGES = [
  "@cavi/data",
  "@cavi/domain",
  "@cavi/gateway-client",
  "@cavi/gateway-transforms",
  "@mobile-cavi/",
] as const;

const FORBIDDEN_PATH_FRAGMENTS = [
  "cavi-control/packages",
  "../cavi-control/packages",
  "../../../../../registry",
  "registry-state.json",
] as const;

const API_PATH_LITERAL_RE = /(["'`])\/(?:api|v1|health|cavi-control|front-door|library|machine|martina|operator|scout|angela|trading|wu-tang)[^"'`]*\1/u;
const PATH_OWNER_RE = /(?:^|[-_/])paths\.ts$/u;
const PATH_COMPAT_FILES = new Set(["endpoints.ts"]);

function walkFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === "dist" || entry === "node_modules") {
      continue;
    }
    const absolute = path.join(root, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...walkFiles(absolute));
      continue;
    }
    if (/\.(?:ts|tsx|json|md)$/u.test(entry)) {
      files.push(absolute);
    }
  }
  return files;
}

function read(relativeOrAbsolute: string): string {
  return readFileSync(relativeOrAbsolute, "utf8");
}

function rel(filePath: string): string {
  return path.relative(PACKAGE_ROOT, filePath);
}

function selfScannedSources(): string[] {
  return [PACKAGE_JSON, ...walkFiles(SRC_ROOT)].filter(
    (filePath) => rel(filePath) !== HARDENING_TEST_PATH,
  );
}

describe("package hardening", () => {
  it("keeps the public dependency surface to @cavi/api-client only", () => {
    const offenders = selfScannedSources().flatMap((filePath) => {
      const source = read(filePath);
      return FORBIDDEN_PACKAGES.filter((pkg) => source.includes(pkg)).map(
        (pkg) => `${rel(filePath)} -> ${pkg}`,
      );
    });

    expect(offenders).toEqual([]);
  });

  it("does not reference quarantined monorepo package paths or host registry imports", () => {
    const offenders = selfScannedSources().flatMap((filePath) => {
      const source = read(filePath);
      return FORBIDDEN_PATH_FRAGMENTS.filter((fragment) => source.includes(fragment)).map(
        (fragment) => `${rel(filePath)} -> ${fragment}`,
      );
    });

    expect(offenders).toEqual([]);
  });

  it("keeps API route literals in path-owner files", () => {
    const offenders = walkFiles(SRC_ROOT)
      .filter((filePath) => {
        const relative = rel(filePath);
        if (/\.test\.tsx?$/u.test(relative)) {
          return false;
        }
        const baseName = path.basename(filePath);
        if (PATH_OWNER_RE.test(relative) || PATH_COMPAT_FILES.has(baseName)) {
          return false;
        }
        return API_PATH_LITERAL_RE.test(read(filePath));
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps endpoints.ts as a compatibility re-export", () => {
    expect(read(path.join(SRC_ROOT, "endpoints.ts")).trim()).toBe('export * from "./paths.js";');
  });

  it("resolves repo roots only from explicit or REPO_ROOT-backed inputs", () => {
    expect(resolveRepoRoot({ repoRoot: " /workspace/project/ " })).toBe("/workspace/project");
    expect(resolveRepoRoot({ env: { REPO_ROOT: "/workspace/from-env/" } })).toBe("/workspace/from-env");
    expect(() => requireRepoRoot({ env: {} })).toThrow(/Missing REPO_ROOT/u);
  });

  it("exposes the gateway-agnostic client alias", () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))) as typeof fetch;
    const client = new GatewayApiClient({ baseUrl: "https://gateway.example", fetchImpl });

    expect(client.surface).toBe("gateway-api");
    expect(client.endpoints.runs).toBe("/v1/runs");
  });
});

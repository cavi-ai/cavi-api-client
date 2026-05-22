import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GATEWAY_PROVIDER_ENV_KEYS,
  GatewayApiClient,
  GatewayAgentConfigApiClient,
  GatewayMediaApiClient,
  GatewayRpcClient,
  GatewaySseRunEventProvider,
  GatewayWebSocketClient,
  GatewayWikiApiClient,
  HERMES_HTTP_API_ENV_ALIASES,
  HERMES_HTTP_API_ENV_KEYS,
  HTTP_API_CLIENT_ENV_ALIASES,
  HTTP_API_CLIENT_ENV_KEYS,
  HermesApiClient,
  HermesMediaApiClient,
  HermesSseRunEventProvider,
  HermesWebSocketClient,
  HermesWikiApiClient,
  OpenClawApiClient,
  OpenClawMediaApiClient,
  OpenClawSseRunEventProvider,
  OpenClawWebSocketClient,
  OpenClawWikiApiClient,
  SURFACE_CONTRACTS,
  TEAM_REGISTRY_CONFIG,
  BUILT_IN_GATEWAY_PROVIDER_MODULES,
  createGatewayApiClient,
  createGatewayAgentConfigClient,
  createGatewayMediaClient,
  createGatewayProviderRegistry,
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
  createGatewayWikiClient,
  createHermesTeamRegistry,
  createOpenClawTeamRegistry,
  requireRepoRoot,
  resolveGatewayProviderKind,
  resolvePath,
  resolveRepoRoot,
  type GatewayProviderModule,
} from "./index";

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SRC_ROOT = path.join(PACKAGE_ROOT, "src");
const PACKAGE_JSON = path.join(PACKAGE_ROOT, "package.json");
const TS_CONFIG = path.join(PACKAGE_ROOT, "tsconfig.json");
const PROVIDERS_GATEWAY_ROOT = path.join(SRC_ROOT, "providers", "gateway");
const CORE_ENV_CONFIG = path.join(SRC_ROOT, "core", "env", "config.ts");
const CORE_HTTP_TYPES = path.join(SRC_ROOT, "core", "http", "types.ts");
const SURFACE_PATHS = path.join(SRC_ROOT, "contracts", "surfaces.ts");
const CAVI_PATHS = path.join(SRC_ROOT, "cavi", "paths.ts");
const CAVI_ROOT = path.join(SRC_ROOT, "cavi");
const CAVI_DATA_ROOT = path.join(SRC_ROOT, "cavi", "data");
const CAVI_DATA_LIB_ROOT = path.join(SRC_ROOT, "cavi", "data", "lib");
const CAVI_RUNTIME_GATEWAY_FETCH = path.join(SRC_ROOT, "cavi", "runtime", "gateway-json-fetch.ts");
const CAVI_RUNTIME_HTTP_TRANSPORT = path.join(SRC_ROOT, "cavi", "runtime", "http-transport.ts");
const CAVI_PORTAL_CLIENT_ID = path.join(SRC_ROOT, "cavi", "portal", "client-id.ts");
const CAVI_PORTAL_CONTRACTS = path.join(SRC_ROOT, "cavi", "portal", "contracts.ts");
const CORE_GATEWAY_WEBSOCKET = path.join(SRC_ROOT, "core", "gateway", "websocket.ts");
const CORE_SSE_INDEX = path.join(SRC_ROOT, "core", "sse", "index.ts");
const CORE_WS_INDEX = path.join(SRC_ROOT, "core", "ws", "index.ts");
const CORE_JSON_HTTP_CLIENT = path.join(SRC_ROOT, "core", "http", "json-client.ts");
const CORE_GATEWAY_FETCH = path.join(SRC_ROOT, "core", "gateway", "fetch.ts");
const CORE_GATEWAY_SNAPSHOT_LOADERS = path.join(SRC_ROOT, "core", "gateway", "snapshot-loaders.ts");
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
const API_TEMPLATE_ROUTE_LITERAL_RE = /`\/(?:api|v1|health|cavi-control|front-door|library|machine|martina|operator|scout|angela|trading|wu-tang)[\s\S]*?`/u;
const API_URL_LITERAL_RE = /(["'`])https?:\/\/[^"'`]*\/(?:api|v1|health|cavi-control|front-door|library|machine|martina|operator|scout|angela|trading|wu-tang)[^"'`]*\1/u;
const CAVI_CONTROL_ROUTE_LITERAL_RE = /(["'`])\/cavi-control\/api(?:\/|["'`])/u;
const SURFACE_FIRST_CANONICAL_PATH_RE = /canonicalPath:\s*(?:\([^)]*\)\s*=>\s*)?(["'`])\/(?:cavi-control|front-door|library|machine|martina|trading)\/api(?:\/|[?]|["'`])/u;
const MARTINA_COMPAT_IDENTIFIER_RE = /\b(?:MARTINA_|Martina[A-Z]\w*|normalizeMartina|inferMartina|martinaRun)/u;
const BAKED_TEAM_REGISTRY_VALUE_RE = /(["'`])(?:angela|deb|front-door|machine|martina|run-dmc|scout|wu-tang|angels|paw-and-order|griselda|headhunter|scout-school)\1/u;
const PATH_OWNER_RE = /(?:^|[-_/])paths\.ts$/u;
const PATH_COMPAT_FILES = new Set<string>();
const CONTRACT_OWNER_FILES = new Set(["src/contracts/surfaces.ts"]);
const ALLOWED_SRC_ROOT_FILES = new Set([
  "src/api-client.test.ts",
  "src/index.ts",
  "src/package-hardening.test.ts",
  "src/team-registry.test.ts",
]);
const LEGACY_TOP_LEVEL_SOURCE_FILES: ReadonlySet<string> = new Set([
  "src/base-client.ts",
  "src/cavi-control-client.ts",
  "src/config.ts",
  "src/endpoints.ts",
  "src/gateway-client.ts",
  "src/gateway-provider.ts",
  "src/hermes-chat-run.ts",
  "src/hermes-client.ts",
  "src/hermes-sse-provider.ts",
  "src/library-client.ts",
  "src/martina-config.ts",
  "src/martina-runs.ts",
  "src/mobile-gateway-contracts.ts",
  "src/paths.ts",
  "src/portal-client.ts",
  "src/portal-paths.ts",
  "src/repo-root.ts",
  "src/resolve.ts",
  "src/run-event-stream.ts",
  "src/run-stream-contracts.ts",
  "src/surface-paths.ts",
  "src/surfaces.ts",
  "src/team-registry.ts",
  "src/team-registry-config.ts",
  "src/types.ts",
] as const);
const LEGACY_SOURCE_PREFIXES = [
  "src/data/",
  "src/domain/",
  "src/gateway/",
  "src/gateway-transforms/",
  "src/hermes/",
  "src/openclaw/",
  "src/portals/",
  "src/compat/legacy/",
  "src/cavi/domain/domain/",
] as const;
const REMOVED_PACKAGE_EXPORTS = [
  "./team-registry",
  "./team-registry-config",
  "./hermes/team-registry",
  "./hermes/team-registry-config",
  "./openclaw/team-registry",
  "./openclaw/team-registry-config",
  "./compat/team-registry",
  "./compat/team-registry-config",
  "./compat/hermes/team-registry",
  "./compat/hermes/team-registry-config",
  "./compat/openclaw/team-registry",
  "./compat/openclaw/team-registry-config",
  "./compat/martina",
  "./compat/martina/config",
  "./compat/martina/runs",
] as const;
const EXPECTED_TS_INCLUDE = [
  "src/index.ts",
  "src/core/**/*.ts",
  "src/contracts/**/*.ts",
  "src/cavi/**/*.ts",
  "src/providers/**/*.ts",
  "src/react/**/*.ts",
  "src/react/**/*.tsx",
] as const;
const ROOT_INDEX_FORBIDDEN_SHIM_EXPORT_RE =
  /from "\.\/(?:base-client|types|config|repo-root|paths|surface-paths|surfaces|resolve|portal-paths|mobile-gateway-contracts|gateway-client|gateway-provider|cavi-control-client|library-client|portal-client|run-event-stream|run-stream-contracts|team-registry|team-registry-config|domain\/|gateway\/|gateway-transforms\/|data\/|hermes\/|openclaw\/)/u;
const PROVIDER_FACTORY_ROOT_EXPORT_RE = /from "\.\/core\/gateway\/provider\.js"/u;
const TEAM_REGISTRY_OWNER_FILES = [
  "src/cavi/registry/team-registry-config.ts",
  "src/providers/hermes/team-registry-config.ts",
  "src/providers/openclaw/team-registry-config.ts",
  "src/cavi/registry/canonical-team-registry.ts",
  "src/cavi/registry/portal-library-registry.ts",
] as const;
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

function walkFilesIfExists(root: string): string[] {
  return existsSync(root) ? walkFiles(root) : [];
}

function read(relativeOrAbsolute: string): string {
  return readFileSync(relativeOrAbsolute, "utf8");
}

function rel(filePath: string): string {
  return path.relative(PACKAGE_ROOT, filePath);
}

function hasApiRouteLiteral(source: string): boolean {
  return API_PATH_LITERAL_RE.test(source) || API_TEMPLATE_ROUTE_LITERAL_RE.test(source);
}

function selfScannedSources(): string[] {
  return [PACKAGE_JSON, ...walkFiles(SRC_ROOT)].filter(
    (filePath) => {
      const relative = rel(filePath);
      return relative !== HARDENING_TEST_PATH && !isTestOnlySource(relative);
    },
  );
}

function legacySourceFiles(): string[] {
  return walkFiles(SRC_ROOT).filter((filePath) => {
    const relative = rel(filePath);
    if (/\.test\.tsx?$/u.test(relative)) {
      return false;
    }
    return (
      LEGACY_TOP_LEVEL_SOURCE_FILES.has(relative) ||
      LEGACY_SOURCE_PREFIXES.some((prefix) => relative.startsWith(prefix))
    );
  });
}

function productionSourceFiles(): string[] {
  return walkFiles(SRC_ROOT).filter((filePath) => {
    const relative = rel(filePath);
    return !isTestOnlySource(relative);
  });
}

function isTestOnlySource(relative: string): boolean {
  return /\.test\.tsx?$/u.test(relative) || relative.startsWith("src/__tests__/");
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

  it("does not reference monorepo package paths or host registry imports", () => {
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
        if (isTestOnlySource(relative)) {
          return false;
        }
        const baseName = path.basename(filePath);
        if (
          PATH_OWNER_RE.test(relative) ||
          PATH_COMPAT_FILES.has(baseName) ||
          CONTRACT_OWNER_FILES.has(relative)
        ) {
          return false;
        }
        return hasApiRouteLiteral(read(filePath));
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("does not hide API route literals inside full URLs", () => {
    const offenders = walkFiles(SRC_ROOT)
      .filter((filePath) => {
        const relative = rel(filePath);
        if (isTestOnlySource(relative)) {
          return false;
        }
        const baseName = path.basename(filePath);
        if (
          PATH_OWNER_RE.test(relative) ||
          PATH_COMPAT_FILES.has(baseName) ||
          CONTRACT_OWNER_FILES.has(relative)
        ) {
          return false;
        }
        return API_URL_LITERAL_RE.test(read(filePath));
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps CAVI route aliases in the top-level CAVI path owner", () => {
    const source = read(CAVI_PATHS);
    const hiddenFeaturePathOwners = walkFiles(CAVI_ROOT)
      .map(rel)
      .filter((relative) => relative.endsWith("/paths.ts"))
      .filter(
        (relative) =>
          relative !== "src/cavi/paths.ts" &&
          relative !== "src/cavi/runtime/paths.ts",
      );

    expect(source).toContain('export * from "../contracts/paths.js";');
    expect(source).toContain("export const DEB_API");
    expect(source).toContain("export const OPERATOR_API");
    expect(hiddenFeaturePathOwners).toEqual([]);
  });

  it("keeps canonical surface contracts api-first", () => {
    expect(read(SURFACE_PATHS)).not.toMatch(SURFACE_FIRST_CANONICAL_PATH_RE);
  });

  it("keeps stale legacy source paths out of src", () => {
    const offenders = legacySourceFiles().map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps src root clean", () => {
    const offenders = walkFiles(SRC_ROOT)
      .map(rel)
      .filter((relative) => path.dirname(relative) === "src")
      .filter((relative) => !ALLOWED_SRC_ROOT_FILES.has(relative));

    expect(offenders).toEqual([]);
  });

  it("does not keep a legacy compat bridge tree", () => {
    const offenders = walkFiles(SRC_ROOT)
      .map(rel)
      .filter((relative) => relative.startsWith("src/compat/legacy/"));

    expect(offenders).toEqual([]);
  });

  it("removes legacy package subpath exports", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      exports: Record<string, unknown>;
      files?: string[];
    };
    const offenders = REMOVED_PACKAGE_EXPORTS.filter(
      (exportKey) => packageJson.exports[exportKey] !== undefined,
    );
    const compatLegacyTargets = Object.entries(packageJson.exports).filter(([, value]) =>
      JSON.stringify(value).includes("compat/legacy"),
    );

    expect(offenders).toEqual([]);
    expect(compatLegacyTargets).toEqual([]);
    expect(packageJson.files).toContain("!dist/test-support");
    expect(packageJson.files).toContain("!dist/__tests__");
    expect(packageJson.files).toContain("!dist/cavi/fallbacks/mock-data");
  });

  it("points the package root at canonical implementation folders", () => {
    expect(read(path.join(SRC_ROOT, "index.ts"))).not.toMatch(
      ROOT_INDEX_FORBIDDEN_SHIM_EXPORT_RE,
    );
    expect(read(path.join(SRC_ROOT, "index.ts"))).not.toMatch(
      PROVIDER_FACTORY_ROOT_EXPORT_RE,
    );
  });

  it("keeps core gateway independent from CAVI and provider implementations", () => {
    const offenders = walkFiles(path.join(SRC_ROOT, "core"))
      .filter((filePath) => {
        const source = read(filePath);
        return /from\s+["'][^"']*(?:providers\/|cavi\/)/u.test(source);
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps provider-specific env naming out of core config", () => {
    expect(read(CORE_ENV_CONFIG)).not.toMatch(/\bhermes\b|HERMES_/iu);
    expect(read(CORE_HTTP_TYPES)).not.toContain("hermes-api-server");
  });

  it("keeps production code independent from test fixtures", () => {
    const offenders = productionSourceFiles()
      .filter((filePath) => /from\s+["'][^"']*(?:test-support|__tests__)\//u.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps runtime CAVI fallbacks out of mock-data paths", () => {
    const offenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/cavi/"))
      .filter((filePath) => /fallbacks\/mock-data/u.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps generic snapshot demo fallbacks product-neutral", () => {
    expect(read(CORE_GATEWAY_SNAPSHOT_LOADERS)).not.toMatch(
      /\b(?:CAVI|Deb|Martina|Machine|Hermes|OpenClaw|discord|teams|Tony|Scout|Wu-Tang)\b/u,
    );
  });

  it("keeps CAVI tests under the shared test tree", () => {
    const offenders = walkFiles(CAVI_ROOT)
      .map(rel)
      .filter((relative) => /\.test\.tsx?$/u.test(relative));

    expect(offenders).toEqual([]);
  });

  it("does not keep CAVI data compatibility shims in active source", () => {
    const importOffenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/cavi/"))
      .filter((filePath) => /["'][^"']*(?:cavi\/data|(?:\.\.\/)+data\/)/u.test(read(filePath)))
      .map(rel);

    expect(walkFilesIfExists(CAVI_DATA_ROOT).map(rel)).toEqual([]);
    expect(existsSync(CAVI_DATA_LIB_ROOT)).toBe(false);
    expect(importOffenders).toEqual([]);
  });

  it("does not keep CAVI core re-export shims in active source", () => {
    const importOffenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/cavi/"))
      .filter((filePath) =>
        /["'][^"']*(?:portal\/client-id|portal\/contracts|runtime\/http-transport)/u.test(read(filePath)),
      )
      .map(rel);

    expect(existsSync(CAVI_RUNTIME_HTTP_TRANSPORT)).toBe(false);
    expect(existsSync(CAVI_PORTAL_CLIENT_ID)).toBe(false);
    expect(existsSync(CAVI_PORTAL_CONTRACTS)).toBe(false);
    expect(importOffenders).toEqual([]);
  });

  it("routes JSON request helpers through shared core HTTP", () => {
    const source = read(CORE_JSON_HTTP_CLIENT);

    expect(source).toContain("BaseHttpApiClient");
    expect(source).not.toMatch(/\bfetch\s*\(/u);
  });

  it("keeps gateway fetch helpers in core gateway", () => {
    const source = read(CORE_GATEWAY_FETCH);
    const importOffenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/cavi/"))
      .filter((filePath) => /gateway-json-fetch/u.test(read(filePath)))
      .map(rel);

    expect(existsSync(CAVI_RUNTIME_GATEWAY_FETCH)).toBe(false);
    expect(source).toContain("createRawHttpApiClient");
    expect(importOffenders).toEqual([]);
  });

  it("keeps generic SSE helpers in core sse", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      exports: Record<string, unknown>;
    };
    const gatewaySseSource = read(path.join(SRC_ROOT, "core", "gateway", "sse-run-event-provider.ts"));

    expect(read(CORE_SSE_INDEX)).toContain('export * from "./stream.js";');
    expect(packageJson.exports["./core/sse"]).toEqual({
      types: "./dist/core/sse/index.d.ts",
      import: "./dist/core/sse/index.js",
      default: "./dist/core/sse/index.js",
    });
    expect(gatewaySseSource).toContain('from "../sse/index.js";');
    expect(gatewaySseSource).not.toMatch(/\bfunction\s+(?:parseSseBlock|takeNextSseBlock|drainBlocks|combineSignals)\b/u);
  });

  it("keeps WebSocket helpers in core ws", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      exports: Record<string, unknown>;
    };
    const importOffenders = productionSourceFiles()
      .filter((filePath) =>
        /from\s+["']\.\/core\/gateway\/websocket\.js["']|from\s+["'][^"']*core\/gateway\/websocket/u.test(
          read(filePath),
        ),
      )
      .map(rel);

    expect(existsSync(CORE_GATEWAY_WEBSOCKET)).toBe(false);
    expect(read(CORE_WS_INDEX)).toContain('export * from "./targets.js";');
    expect(packageJson.exports["./core/ws"]).toEqual({
      types: "./dist/core/ws/index.d.ts",
      import: "./dist/core/ws/index.js",
      default: "./dist/core/ws/index.js",
    });
    expect(importOffenders).toEqual([]);
  });

  it("exposes gateway provider plugins from a dedicated provider module", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      exports: Record<string, unknown>;
    };
    const providerBarrel = read(path.join(SRC_ROOT, "providers", "gateway-provider.ts")).trim();
    const expectedProviderFiles = [
      "built-ins.ts",
      "factory.ts",
      "index.ts",
      "normalize.ts",
      "registry.ts",
      "types.ts",
    ];
    const providerSpecificFiles = ["factory.ts", "normalize.ts", "registry.ts", "types.ts"];

    expect(packageJson.exports["./providers/gateway"]).toEqual({
      types: "./dist/providers/gateway/index.d.ts",
      import: "./dist/providers/gateway/index.js",
      default: "./dist/providers/gateway/index.js",
    });
    expect(providerBarrel).toBe('export * from "./gateway/index.js";');
    expect(expectedProviderFiles.filter((file) =>
      !existsSync(path.join(PROVIDERS_GATEWAY_ROOT, file)),
    )).toEqual([]);
    expect(read(path.join(PROVIDERS_GATEWAY_ROOT, "types.ts"))).toContain(
      "export interface GatewayProviderModule extends GatewayProviderFactories",
    );
    expect(read(path.join(PROVIDERS_GATEWAY_ROOT, "built-ins.ts"))).toContain(
      "HermesApiClient",
    );
    expect(providerSpecificFiles.filter((file) =>
      /\b(?:Hermes|OpenClaw)\b/u.test(read(path.join(PROVIDERS_GATEWAY_ROOT, file))),
    )).toEqual([]);
    expect(BUILT_IN_GATEWAY_PROVIDER_MODULES.map((module) => module.kind)).toEqual([
      "gateway",
      "hermes",
      "openclaw",
    ]);
  });

  it("keeps CAVI production modules on shared HTTP transports", () => {
    const offenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/cavi/"))
      .filter((filePath) => /\bfetch\s*\(/u.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("builds only canonical and compat folders", () => {
    const tsconfig = JSON.parse(read(TS_CONFIG)) as {
      include?: string[];
      exclude?: string[];
    };

    expect(tsconfig.include).toEqual([...EXPECTED_TS_INCLUDE]);
    expect(tsconfig.include).not.toContain("src/**/*.ts");
    expect(tsconfig.include).not.toContain("src/**/*.tsx");
    expect(tsconfig.include).not.toContain("src/compat/**/*.ts");
    expect(tsconfig.exclude).toContain("src/__tests__/**");
    expect(tsconfig.exclude).toContain("quarantine/**");
  });

  it("does not keep Martina compatibility implementation modules in active source", () => {
    const offenders = selfScannedSources()
      .filter((filePath) => MARTINA_COMPAT_IDENTIFIER_RE.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps team registry data runtime-supplied instead of baked into the package", () => {
    const offenders = TEAM_REGISTRY_OWNER_FILES.filter((relativePath) =>
      BAKED_TEAM_REGISTRY_VALUE_RE.test(read(path.join(PACKAGE_ROOT, relativePath))),
    );

    expect(offenders).toEqual([]);
    expect(read(path.join(SRC_ROOT, "index.ts"))).not.toContain(
      "CAVI_TEAM_PORTAL_IDS",
    );
    expect(TEAM_REGISTRY_CONFIG.teams).toEqual([]);
    expect(createHermesTeamRegistry().listTeams()).toEqual([]);
    expect(createOpenClawTeamRegistry().listTeams()).toEqual([]);
  });

  it("does not expose Mission Control aliases", () => {
    const offenders = selfScannedSources()
      .filter((filePath) =>
        /MissionControl|mission-control|missionControl/u.test(read(filePath)),
      )
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("does not keep endpoint compatibility shims in src", () => {
    expect(legacySourceFiles().map(rel)).not.toContain("src/endpoints.ts");
  });

  it("keeps surface contract keys and critical canonical paths aligned", () => {
    const mismatchedKeys = Object.entries(SURFACE_CONTRACTS)
      .filter(([key, contract]) => contract.key !== key)
      .map(([key, contract]) => `${key} -> ${contract.key}`);

    expect(mismatchedKeys).toEqual([]);
    expect(resolvePath("cavi.operator.tasks", "canonical")).toBe("/api/plugins/kanban/tasks");
    expect(resolvePath("cavi.operator.snapshot", "canonical")).toBe(
      "/api/plugins/cavi-control/operator/snapshot",
    );
    expect(resolvePath("portalMemory.snapshot", "canonical", {
      teamSlug: "machine",
      memberId: "chris",
      memoryKey: "comedy-room",
    })).toBe("/api/plugins/portal-memory/teams/machine/members/chris/comedy-room");
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
    const media = new GatewayMediaApiClient({ baseUrl: "https://gateway.example", fetchImpl });
    const wiki = new GatewayWikiApiClient({ baseUrl: "https://gateway.example", fetchImpl });

    expect(client.surface).toBe("gateway-api");
    expect(client.endpoints.runs).toBe("/v1/runs");
    expect(media.surface).toBe("gateway-media-api");
    expect(media.endpoints.generate("audio")).toBe("/v1/media/audio/generate");
    expect(wiki.surface).toBe("gateway-wiki-api");
    expect(wiki.endpoints.compile("research")).toBe("/v1/wiki/vaults/research/compile");
  });

  it("selects gateway implementations by explicit provider or env", () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))) as typeof fetch;
    const hermes = createGatewayApiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "hermes" },
    );
    const openclaw = createGatewayApiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { env: { CAVI_GATEWAY_PROVIDER: "openclaw" } },
    );
    const hermesMedia = createGatewayMediaClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "hermes" },
    );
    const openclawMedia = createGatewayMediaClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "openclaw" },
    );
    const hermesWiki = createGatewayWikiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "hermes" },
    );
    const openclawWiki = createGatewayWikiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "openclaw" },
    );
    const genericWs = createGatewayWebSocketClient(
      "wss://gateway.example/ws",
      "token",
      { clientId: "client-1" },
      { provider: "gateway" },
    );
    const hermesWs = createGatewayWebSocketClient(
      "wss://gateway.example/api/ws",
      "token",
      { clientId: "client-1" },
      { provider: "hermes" },
    );
    const openclawWs = createGatewayWebSocketClient(
      "wss://gateway.example/ws",
      "token",
      { clientId: "client-1" },
      { provider: "openclaw" },
    );
    const genericSse = createGatewaySseRunEventProvider(
      {
        httpBase: "https://gateway.example",
        authToken: "token",
        clientId: "client-1",
      },
      { provider: "gateway" },
    );
    const hermesSse = createGatewaySseRunEventProvider(
      {
        httpBase: "https://gateway.example",
        authToken: "token",
        clientId: "client-1",
        sessionKey: "session-1",
      },
      { provider: "hermes" },
    );
    const openclawSse = createGatewaySseRunEventProvider(
      {
        httpBase: "https://gateway.example",
        authToken: "token",
        clientId: "client-1",
      },
      { provider: "openclaw" },
    );

    expect(resolveGatewayProviderKind({ env: { GATEWAY_PROVIDER: "generic" } })).toBe("gateway");
    expect(GATEWAY_PROVIDER_ENV_KEYS).toEqual(["CAVI_GATEWAY_PROVIDER", "GATEWAY_PROVIDER"]);
    expect(resolveGatewayProviderKind({ provider: "open-claw" })).toBe("openclaw");
    expect(() => resolveGatewayProviderKind({ provider: "martina" })).toThrow(
      'Unknown gateway provider "martina"',
    );
    expect(hermes).toBeInstanceOf(HermesApiClient);
    expect(hermes.surface).toBe("hermes-api-server");
    expect(openclaw).toBeInstanceOf(OpenClawApiClient);
    expect(openclaw).toBeInstanceOf(GatewayApiClient);
    expect(openclaw.surface).toBe("openclaw-api");
    expect(hermesMedia).toBeInstanceOf(HermesMediaApiClient);
    expect(hermesMedia.surface).toBe("hermes-media-api");
    expect(openclawMedia).toBeInstanceOf(OpenClawMediaApiClient);
    expect(openclawMedia.surface).toBe("openclaw-media-api");
    expect(hermesWiki).toBeInstanceOf(HermesWikiApiClient);
    expect(hermesWiki.surface).toBe("hermes-wiki-api");
    expect(openclawWiki).toBeInstanceOf(OpenClawWikiApiClient);
    expect(openclawWiki.surface).toBe("openclaw-wiki-api");
    expect(genericWs).toBeInstanceOf(GatewayRpcClient);
    expect(hermesWs).toBeInstanceOf(HermesWebSocketClient);
    expect(openclawWs).toBeInstanceOf(OpenClawWebSocketClient);
    expect(genericSse).toBeInstanceOf(GatewaySseRunEventProvider);
    expect(hermesSse).toBeInstanceOf(HermesSseRunEventProvider);
    expect(openclawSse).toBeInstanceOf(OpenClawSseRunEventProvider);
  });

  it("allows custom gateway provider modules without factory branches", () => {
    class AcmeApiClient extends GatewayApiClient {
      constructor(options: ConstructorParameters<typeof GatewayApiClient>[0]) {
        super(options, "acme-api");
      }
    }
    class AcmeWebSocketClient extends GatewayWebSocketClient {}
    class AcmeSseRunEventProvider extends GatewaySseRunEventProvider {}
    class AcmeMediaClient extends GatewayMediaApiClient {
      constructor(options: ConstructorParameters<typeof GatewayMediaApiClient>[0]) {
        super(options, { surface: "acme-media-api" });
      }
    }
    class AcmeWikiClient extends GatewayWikiApiClient {
      constructor(options: ConstructorParameters<typeof GatewayWikiApiClient>[0]) {
        super(options, { surface: "acme-wiki-api" });
      }
    }
    class AcmeAgentConfigClient extends GatewayAgentConfigApiClient {
      constructor(options: ConstructorParameters<typeof GatewayAgentConfigApiClient>[0]) {
        super(options, { surface: "acme-agent-config-api" });
      }
    }

    const acmeProvider: GatewayProviderModule = {
      kind: "acme",
      aliases: ["acme-gateway"],
      createApiClient: (options) => new AcmeApiClient(options),
      createWebSocketClient: (wsUrl, authToken, options) =>
        new AcmeWebSocketClient(wsUrl, authToken, {
          ...options,
          clientMode: "acme-ws",
        }),
      createSseRunEventProvider: (options) =>
        new AcmeSseRunEventProvider({
          ...options,
          headers: { "X-Acme-Route": "sse" },
        }),
      createMediaClient: (options) => new AcmeMediaClient(options),
      createWikiClient: (options) => new AcmeWikiClient(options),
      createAgentConfigClient: (options) => new AcmeAgentConfigClient(options),
    };
    const betaProvider: GatewayProviderModule = {
      kind: "beta",
      createApiClient: (options) => new GatewayApiClient(options, "beta-api"),
    };
    const registry = createGatewayProviderRegistry({
      modules: [acmeProvider],
    });
    const fetchImpl = (() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))) as typeof fetch;
    const clientOptions = { baseUrl: "https://gateway.example", fetchImpl };

    expect(resolveGatewayProviderKind({
      provider: "acme-gateway",
      registry,
    })).toBe("acme");
    expect(createGatewayApiClient(clientOptions, {
      provider: "acme",
      registry,
    })).toBeInstanceOf(AcmeApiClient);
    expect(createGatewayWebSocketClient("wss://gateway.example/ws", "token", {}, {
      provider: "acme",
      registry,
    })).toBeInstanceOf(AcmeWebSocketClient);
    expect(createGatewaySseRunEventProvider({
      httpBase: "https://gateway.example",
      authToken: "token",
      clientId: "client-1",
    }, {
      provider: "acme",
      registry,
    })).toBeInstanceOf(AcmeSseRunEventProvider);
    expect(createGatewayMediaClient(clientOptions, {
      provider: "acme",
      registry,
    })).toBeInstanceOf(AcmeMediaClient);
    expect(createGatewayWikiClient(clientOptions, {
      provider: "acme",
      registry,
    })).toBeInstanceOf(AcmeWikiClient);
    expect(createGatewayAgentConfigClient(clientOptions, {
      provider: "acme",
      registry,
    })).toBeInstanceOf(AcmeAgentConfigClient);
    expect(createGatewayApiClient(clientOptions, {
      provider: "beta",
      registry,
      providerModules: [betaProvider],
    }).surface).toBe("beta-api");
    expect(() => resolveGatewayProviderKind({
      provider: "acme",
    })).toThrow('Unknown gateway provider "acme"');
    expect(() => createGatewayProviderRegistry({
      modules: [{ kind: "gateway" }],
    })).toThrow('Duplicate gateway provider key "gateway"');
    expect(createGatewayProviderRegistry({
      modules: [{ kind: "gateway" }],
      allowOverrides: true,
    }).resolveProvider("generic")?.kind).toBe("gateway");
  });

  it("keeps generic HTTP env maps gateway-agnostic", () => {
    expect(Object.keys(HTTP_API_CLIENT_ENV_KEYS).filter((key) => /hermes/iu.test(key))).toEqual([]);
    expect(Object.values(HTTP_API_CLIENT_ENV_KEYS).filter((value) => /HERMES/u.test(value))).toEqual([]);
    expect(Object.keys(HTTP_API_CLIENT_ENV_ALIASES).filter((key) => /hermes/iu.test(key))).toEqual([]);
    expect(HERMES_HTTP_API_ENV_KEYS).toEqual({
      baseUrl: "HERMES_API_BASE_URL",
      authToken: "HERMES_API_AUTH_TOKEN",
      clientId: "HERMES_API_CLIENT_ID",
    });
    expect(HERMES_HTTP_API_ENV_ALIASES.baseUrl).toContain(
      "EXPO_PUBLIC_HERMES_API_BASE_URL",
    );
  });
});

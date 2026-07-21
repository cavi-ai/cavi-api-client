import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  GATEWAY_PROVIDER_ENV_KEYS,
  GatewayApiClient,
  SURFACE_CONTRACTS,
  createGatewayApiClient,
  createGatewayAgentConfigClient,
  createGatewayMediaClient,
  createGatewayProviderRegistry,
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
  createGatewayWikiClient,
  createSurfacePathResolver,
  requireRepoRoot,
  resolveGatewayProviderKind,
  resolvePath,
  resolveRepoRoot,
  resolveSurfaceContractPath,
  type GatewayProviderModule,
} from "../index";
import {
  GatewayAgentConfigApiClient,
  GatewayMediaApiClient,
  GatewayRpcClient,
  GatewaySseRunEventProvider,
  GatewayWikiApiClient,
  portalConfigPatchPath,
} from "../core/gateway/index";
import { GatewayWebSocketClient } from "../core/ws/index";
import {
  HERMES_HTTP_API_ENV_ALIASES,
  HERMES_HTTP_API_ENV_KEYS,
  HermesAgentConfigApiClient,
  HermesApiClient,
  HermesMediaApiClient,
  HERMES_PROVIDER_MODULE,
  HermesSseRunEventProvider,
  HermesWebSocketClient,
  HermesWikiApiClient,
  createHermesTeamRegistry,
} from "../providers/hermes/index";
import {
  OpenClawApiClient,
  OpenClawAgentConfigApiClient,
  OpenClawMediaApiClient,
  OPENCLAW_PROVIDER_MODULE,
  OpenClawSseRunEventProvider,
  OpenClawWebSocketClient,
  OpenClawWikiApiClient,
  createOpenClawTeamRegistry,
} from "../providers/openclaw/index";
import {
  CodexApiClient,
  createCodexProviderModule,
} from "../providers/codex/index";
import {
  HTTP_API_CLIENT_ENV_ALIASES,
  HTTP_API_CLIENT_ENV_KEYS,
  CAVI_SURFACE_CONTRACTS,
  TEAM_REGISTRY_CONFIG,
  appendCaviApiPath,
  resolveCaviPath,
  resolveLibraryApiPath,
  resolvePluginApiPath,
  resolvePortalApiPath,
} from "../extensions/cavi/index";

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const BUILT_IN_PROVIDER_MODULES = [
  HERMES_PROVIDER_MODULE,
  OPENCLAW_PROVIDER_MODULE,
] as const;
const SRC_ROOT = path.join(PACKAGE_ROOT, "src");
const DIST_ROOT = path.join(PACKAGE_ROOT, "dist");
const DIST_CORE_GATEWAY_ROOT = path.join(PACKAGE_ROOT, "dist", "core", "gateway");
const PACKAGE_JSON = path.join(PACKAGE_ROOT, "package.json");
const TS_CONFIG = path.join(PACKAGE_ROOT, "tsconfig.json");
const CORE_GATEWAY_PROVIDERS_ROOT = path.join(SRC_ROOT, "core", "gateway", "providers");
const CORE_ENV_CONFIG = path.join(SRC_ROOT, "core", "env", "config.ts");
const CORE_HTTP_TYPES = path.join(SRC_ROOT, "core", "http", "types.ts");
const CORE_GATEWAY_AGENT_CONFIG = path.join(SRC_ROOT, "core", "gateway", "agent", "config.ts");
const CORE_GATEWAY_INDEX = path.join(SRC_ROOT, "core", "gateway", "index.ts");
const CORE_GATEWAY_PROVIDER = path.join(SRC_ROOT, "core", "gateway", "provider.ts");
const CORE_GATEWAY_ROOT = path.join(SRC_ROOT, "core", "gateway");
const CORE_CONTRACT_PATHS = path.join(SRC_ROOT, "contracts", "paths.ts");
const SURFACE_PATHS = path.join(SRC_ROOT, "contracts", "surfaces.ts");
const TEAM_MANIFEST_CONTRACT = path.join(SRC_ROOT, "contracts", "team-manifest.ts");
const CAVI_CONTRACT_PATHS = path.join(SRC_ROOT, "extensions", "cavi", "contracts", "paths.ts");
const CAVI_TEAM_REGISTRY = path.join(SRC_ROOT, "extensions", "cavi", "registry", "team-registry.ts");
const CAVI_ROOT = path.join(SRC_ROOT, "extensions", "cavi");
const CAVI_FALLBACK_SNAPSHOTS_ROOT = path.join(CAVI_ROOT, "fallbacks", "snapshots");
const CAVI_DATA_ROOT = path.join(SRC_ROOT, "extensions", "cavi", "data");
const CAVI_DATA_LIB_ROOT = path.join(SRC_ROOT, "extensions", "cavi", "data", "lib");
const CAVI_RUNTIME_GATEWAY_FETCH = path.join(SRC_ROOT, "extensions", "cavi", "runtime", "gateway-json-fetch.ts");
const CAVI_RUNTIME_HTTP_TRANSPORT = path.join(SRC_ROOT, "extensions", "cavi", "runtime", "http-transport.ts");
const CAVI_PORTAL_CLIENT_ID = path.join(SRC_ROOT, "extensions", "cavi", "portal", "client-id.ts");
const CAVI_PORTAL_CONTRACTS = path.join(SRC_ROOT, "extensions", "cavi", "portal", "contracts.ts");
const CORE_GATEWAY_WEBSOCKET = path.join(SRC_ROOT, "core", "gateway", "websocket.ts");
const CORE_SSE_INDEX = path.join(SRC_ROOT, "core", "sse", "index.ts");
const CORE_WS_INDEX = path.join(SRC_ROOT, "core", "ws", "index.ts");
const CORE_TRANSPORT_INDEX = path.join(SRC_ROOT, "core", "transport", "index.ts");
const CORE_TRANSPORT_NODE_INDEX = path.join(SRC_ROOT, "core", "transport", "node", "index.ts");
const CORE_JSON_HTTP_CLIENT = path.join(SRC_ROOT, "core", "http", "json-client.ts");
const CORE_GATEWAY_FETCH = path.join(SRC_ROOT, "core", "gateway", "client", "fetch.ts");
const CORE_GATEWAY_SNAPSHOT_LOADERS = path.join(SRC_ROOT, "core", "gateway", "snapshots", "loaders.ts");
const REACT_GATEWAY_PROVIDER = path.join(SRC_ROOT, "frameworks", "react", "gateway-provider.tsx");
const HARDENING_TEST_PATH = "src/__tests__/package-hardening.test.ts";
const PROVIDER_EXTENSION_IMPORT_ALLOWLIST = new Set<string>([
  "src/providers/hermes/team-registry.ts",
  "src/providers/hermes/team-registry-config.ts",
  "src/providers/openclaw/team-registry.ts",
  "src/providers/openclaw/team-registry-config.ts",
]);
const CAVI_GENERIC_IMPLEMENTATION_FILENAME_ALLOWLIST = new Set<string>([
  "src/extensions/cavi/fallbacks/snapshots/operator-control/snapshot.ts",
]);
// Frozen with TypeScript's module checker from origin/main at
// 0a8864a216ba68f1fabec537ca02951ee305b475. Additions require an explicit
// allowlist entry below; never regenerate this from the working tree.
const ROOT_EXPORT_BASELINE = path.join(
  SRC_ROOT,
  "__tests__",
  "fixtures",
  "root-exports-origin-main.json",
);
const TRANSPORT_NODE_REEXPORT_FIXTURE = path.join(
  SRC_ROOT,
  "__tests__",
  "fixtures",
  "transport-node-reexport",
  "entry.ts",
);
const APPROVED_ROOT_TRANSPORT_ADDITIONS = [
  "TransportError",
  "TransportErrorMetadata",
  "TransportKind",
  "TransportLifecycleEvent",
  "getTransportErrorMetadata",
] as const;
// The frozen baseline only expressed additions. A removal from the root
// surface is a breaking change, so it is listed here explicitly rather than by
// regenerating the baseline from the working tree.
const APPROVED_ROOT_REMOVALS = new Set<string>([
  // RuntimeControlPlane was a second control-plane contract beside
  // RuntimeControlClient: no provider implemented it, nothing constructed one,
  // and its provider-module slot (createControlPlane) had no implementers.
  "RuntimeControlPlane",
]);
const APPROVED_ROOT_RUNTIME_CONTROL_CLIENT_ADDITIONS = [
  "RuntimeControlClient",
  "RuntimeControlClientFactory",
  "RuntimeControlClientOptions",
  "CapabilityUnavailable",
  "createRuntimeControlClient",
  "RuntimeControlExtensionDescriptor",
  "RuntimeControlExtensionRegistry",
  "createRuntimeControlExtensionRegistry",
  "defineRuntimeControlExtension",
  "withRuntimeControlExtensions",
  "GATEWAY_RAW_EXTENSION",
  "RawGatewayChannel",
  "RawGatewayConnectionState",
  "RawGatewayEvent",
  "RawGatewayRequestOptions",
] as const;

// The unified capability contract (single-client redesign): the taxonomy, the
// runtime capability source, the capability client, and the one front door.
const APPROVED_ROOT_CAPABILITY_CONTRACT_ADDITIONS = [
  "CAPABILITY_TAXONOMY",
  "CAPABILITY_GROUPS",
  "supportsCapability",
  "isCapabilityKey",
  "CapabilityKey",
  "CapabilityGroup",
  "CapabilityMap",
  "CapabilitySupport",
  "mergeCapabilitySupport",
  "resolvedSupports",
  "ProviderCapabilityResolver",
  "ResolvedProviderCapabilities",
  "createCapabilityClient",
  "CapabilityClient",
  "CapabilityClientBackends",
  "CreateCapabilityClientOptions",
  "createApiClient",
  "CreateApiClientOptions",
  "PROVIDER_CAPABILITIES",
  "declaredCapabilities",
] as const;

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

// Route-literal roots are GENERIC platform roots only — NO per-agent fleet slugs.
// Fleet agents are manifest-supplied, so their routes never appear in package source;
// the FLEET_SLUG_RE regression net below guards against any reappearing.
const ROUTE_ROOTS = "api|v1|health|healthz|readyz|cavi-control|library|operator";
const API_PATH_LITERAL_RE = new RegExp(`(["'\`])\\/(?:${ROUTE_ROOTS})[^"'\`]*\\1`, "u");
const API_TEMPLATE_ROUTE_LITERAL_RE = new RegExp(`\`\\/(?:${ROUTE_ROOTS})[\\s\\S]*?\``, "u");
const API_URL_LITERAL_RE = new RegExp(
  `(["'\`])https?:\\/\\/[^"'\`]*\\/(?:${ROUTE_ROOTS})[^"'\`]*\\1`,
  "u",
);
const CAVI_CONTROL_ROUTE_LITERAL_RE = /(["'`])\/cavi-control\/api(?:\/|["'`])/u;
const CAVI_EXTENSION_ROUTE_RE = /(?:cavi-control|portal-memory|\/library\/api|extensions\/cavi)/u;
// Regression net: no CAVI fleet-agent slug may reappear baked into the package.
const FLEET_SLUG_RE = /\b(?:martina|scout|angela|machine|trading|wu-tang|front-door|deb|tony|method-man)\b/u;
// PLAN-DEVIATION: the plan's draft regex was `api|v1|health` only, on the
// (incorrect) assumption that every contract resolves under one of those
// roots. In reality, CAVI_SURFACE_CONTRACTS' `cavi.operator.*` entries
// canonically resolve under `/cavi-control/api/operator/...` — see
// `CAVI_CONTROL_OPERATOR_API_BASE` in extensions/cavi/contracts/paths.ts,
// whose own comment documents this as the deliberate canonical mount (with
// `/api/plugins/cavi-control/operator` kept only as a fallback alias). That
// root is already part of this file's own established ROUTE_ROOTS allowlist
// above, so it's added here too rather than flagging real, intentional
// production routes as violations.
const API_FIRST_SURFACE_PATH_RE = /^\/(?:api|v1|health|cavi-control)(?:\/|$)/u;
// One shared params bag covering every path param name used across both
// SURFACE_CONTRACTS maps (global + CAVI), so every contract's `path(...)`
// can be resolved for real instead of regexing source text for a field
// ("canonicalPath") that doesn't exist.
const SAMPLE_SURFACE_PARAMS: Record<string, string> = {
  kind: "audio",
  jobId: "job-1",
  assetId: "asset-1",
  vaultId: "vault-1",
  path: "notes/example.md",
  teamId: "team-1",
  workspacePath: "src/index.ts",
  actionId: "action-1",
  agentId: "agent-1",
  portal: "portal-1",
  taskId: "task-1",
  teamSlug: "team-1",
  memberId: "member-1",
  memoryKey: "memory-1",
};
const PATH_OWNER_RE = /(?:^|[-_/])paths\.ts$/u;
const PATH_COMPAT_FILES = new Set<string>();
const CONTRACT_OWNER_FILES = new Set([
  "src/contracts/surfaces.ts",
  "src/extensions/cavi/contracts/surfaces.ts",
  "src/extensions/cavi/library/clip-contract.json",
  // Provider manifests mirror the upstream gateway docs and own that provider's
  // route literals. As more providers/plugins land, consider promoting this to
  // a `**/manifest.ts` regex.
  "src/providers/openclaw/manifest.ts",
]);
const ALLOWED_SRC_ROOT_FILES = new Set(["src/index.ts"]);
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
  "src/extensions/cavi/domain/domain/",
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
  "src/extensions/**/*.ts",
  "src/providers/**/*.ts",
  "src/testing/**/*.ts",
  "src/frameworks/**/*.ts",
  "src/frameworks/**/*.tsx",
] as const;
const ROOT_INDEX_FORBIDDEN_SHIM_EXPORT_RE =
  /from "\.\/(?:base-client|types|config|repo-root|paths|surface-paths|surfaces|resolve|portal-paths|mobile-gateway-contracts|gateway-client|gateway-provider|cavi-control-client|library-client|portal-client|run-event-stream|run-stream-contracts|team-registry|team-registry-config|domain\/|gateway\/|gateway-transforms\/|data\/|hermes\/|openclaw\/)/u;
const PROVIDER_FACTORY_ROOT_EXPORT_RE = /from "\.\/core\/gateway\/provider\.js"/u;
const CORE_GATEWAY_COMPAT_BARREL_IMPORT_RE =
  /from\s+["'][^"']*(?:core\/gateway\/|(?:\.\.\/)+gateway\/)(?:client|error-details|fetch|runtime-targets|media|wiki|envelope|envelope-types|cache|agent-commands|agent-config|agent-voice-config|run-event-stream|run-stream-contracts|sse-run-event-provider|stream-failure|session-loaders|snapshot-loaders|system-loaders|transforms|rpc|rpc-error|device-crypto|device-store|preauth-handshake|portal-config-patch)(?:\.js)?["']/u;
const TEAM_REGISTRY_OWNER_FILES = [
  "src/extensions/cavi/registry/team-registry-config.ts",
  "src/providers/hermes/team-registry-config.ts",
  "src/providers/openclaw/team-registry-config.ts",
  "src/extensions/cavi/registry/canonical-team-registry.ts",
  "src/extensions/cavi/registry/portal-library-registry.ts",
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
    if (/\.(?:js|ts|tsx|json|md)$/u.test(entry)) {
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

function sourceCandidatesForDistArtifact(filePath: string): string[] {
  const relative = path.relative(DIST_ROOT, filePath);
  if (relative.endsWith(".d.ts")) {
    const sourceBase = relative.slice(0, -".d.ts".length);
    return [
      path.join(SRC_ROOT, `${sourceBase}.ts`),
      path.join(SRC_ROOT, `${sourceBase}.tsx`),
    ];
  }
  if (relative.endsWith(".js")) {
    const sourceBase = relative.slice(0, -".js".length);
    return [
      path.join(SRC_ROOT, `${sourceBase}.ts`),
      path.join(SRC_ROOT, `${sourceBase}.tsx`),
    ];
  }
  return [];
}

function isTestOnlySource(relative: string): boolean {
  return /\.test\.tsx?$/u.test(relative) || relative.startsWith("src/__tests__/");
}

function relativeImportGraph(entry: string): string[] {
  const visited = new Set<string>();
  const visit = (filePath: string): void => {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    const source = read(filePath);
    for (const specifier of staticModuleSpecifiers(source, filePath)) {
      if (!specifier.startsWith(".")) continue;
      const target = path.resolve(path.dirname(filePath), specifier.replace(/\.js$/u, ".ts"));
      if (existsSync(target)) visit(target);
    }
  };
  visit(entry);
  return [...visited];
}

function staticModuleSpecifiers(source: string, fileName = "source.ts"): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  for (const statement of sourceFile.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      specifiers.push(statement.moduleSpecifier.text);
      continue;
    }
    if (ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteral(statement.moduleReference.expression)) {
      specifiers.push(statement.moduleReference.expression.text);
    }
  }
  return specifiers;
}

function staticNodeSpecifiers(source: string, fileName?: string): string[] {
  return staticModuleSpecifiers(source, fileName).filter((specifier) =>
    specifier.startsWith("node:"));
}

function rootExportNames(entry: string): string[] {
  const program = ts.createProgram([entry], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    skipLibCheck: true,
  });
  const source = program.getSourceFile(entry);
  if (!source) throw new Error(`TypeScript did not load ${entry}`);
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(source);
  if (!symbol) throw new Error(`TypeScript did not resolve the module symbol for ${entry}`);
  return checker.getExportsOfModule(symbol).map((current) => current.name).sort();
}

describe("package hardening", () => {
  it("keeps the public dependency surface to @cavi-ai/api-client only", () => {
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

  it("keeps CAVI route aliases in the CAVI extension path owner", () => {
    const source = read(CAVI_CONTRACT_PATHS);
    const hiddenFeaturePathOwners = walkFiles(CAVI_ROOT)
      .map(rel)
      .filter((relative) => relative.endsWith("/paths.ts"))
      .filter(
        (relative) =>
          relative !== "src/extensions/cavi/contracts/paths.ts" &&
          relative !== "src/extensions/cavi/runtime/paths.ts",
      );

    expect(source).toContain("export const CAVI_CONTROL_OPERATOR_API");
    expect(source).toContain("export const LIBRARY_API_BASE_PATH");
    expect(source).toContain("export function resolvePluginApiPath");
    expect(hiddenFeaturePathOwners).toEqual([]);
  });

  it("keeps CAVI extension routes out of core contracts", () => {
    const coreContracts = [CORE_CONTRACT_PATHS, SURFACE_PATHS].map(read).join("\n");

    expect(coreContracts).not.toMatch(CAVI_EXTENSION_ROUTE_RE);
  });

  it("keeps shipped CAVI fallback snapshots free of host-local paths and internal URLs", () => {
    const forbiddenFallbackSnapshotLiteral =
      /http:\/\/[^"'\s`]*\.internal|\/(?:workspace|state|var\/lib)(?:\/|["'\s`])|\/teams\/[^"'\s`]*workspace/u;
    const offenders = walkFiles(CAVI_FALLBACK_SNAPSHOTS_ROOT)
      .filter((filePath) => /\.(?:ts|json)$/u.test(filePath))
      .filter((filePath) => forbiddenFallbackSnapshotLiteral.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps canonical surface contracts api-first", () => {
    // Executes every contract's real path(...) resolver — global SURFACE_CONTRACTS
    // (../contracts/surfaces.ts) and CAVI_SURFACE_CONTRACTS (../extensions/cavi/
    // contracts/surfaces.ts) — instead of regexing source text for a field name
    // ("canonicalPath") that never existed on SurfaceContract (the field is `path`).
    const allContracts = { ...SURFACE_CONTRACTS, ...CAVI_SURFACE_CONTRACTS };
    const offenders = Object.entries(allContracts)
      .map(([key, contract]) => ({
        key,
        resolved: resolveSurfaceContractPath(contract, SAMPLE_SURFACE_PARAMS),
      }))
      .filter(({ resolved }) => !API_FIRST_SURFACE_PATH_RE.test(resolved))
      .map(({ key, resolved }) => `${key} -> ${resolved}`);

    expect(offenders).toEqual([]);
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

  it("keeps private Superpowers artifacts out of version control", () => {
    const gitignore = read(path.join(PACKAGE_ROOT, ".gitignore"));
    expect(gitignore.split(/\r?\n/u)).toEqual(
      expect.arrayContaining([".superpowers/", "docs/superpowers/"]),
    );

    const tracked = execFileSync(
      "git",
      ["ls-files", ".superpowers/**", "docs/superpowers/**"],
      { cwd: PACKAGE_ROOT, encoding: "utf8" },
    ).trim();
    expect(tracked).toBe("");
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
    // Runtime withFallback() data lives in extensions/cavi/fallbacks/snapshots and
    // is imported by the shipped ./extensions/cavi adapters, so it MUST ship.
    // Guard against anyone re-adding an exclusion that would strip it from dist.
    expect(packageJson.files).not.toContain("!dist/extensions/cavi/fallbacks");
    expect(packageJson.files).not.toContain("!dist/extensions/cavi/fallbacks/snapshots");
  });

  it("builds automatically before packing or publishing", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toContain("pnpm run clean");
    expect(packageJson.scripts?.prepack).toBe("pnpm run build");
    expect(packageJson.scripts?.prepublishOnly).toBe("pnpm run verify");
    expect(packageJson.scripts?.verify).toBe(
      // Two deliberate changes from the original chain:
      // 1. The stable artifact is provisioned explicitly (respecting an already-set
      //    env var) so the docs gates still receive it explicitly and never fetch
      //    implicitly, while `pnpm run verify` needs no manual setup.
      // 2. Markdown linting delegates to `lint:md` so verify and CI lint the exact
      //    same file set (the curated globs in .markdownlint-cli2.jsonc). The old
      //    inline '**/*.md' override rescanned the whole tree, including nested
      //    node_modules under stray worktrees, which made verify unrunnable locally.
      'pnpm run clean && pnpm test && export CAVI_API_CLIENT_STABLE_TARBALL="${CAVI_API_CLIENT_STABLE_TARBALL:-$(node scripts/docs/fetch-stable.mjs)}" && export CAVI_DOCS_PACKAGE_TGZ="${CAVI_DOCS_PACKAGE_TGZ:-$CAVI_API_CLIENT_STABLE_TARBALL}" && pnpm run typecheck:docs && pnpm run build && pnpm run docs:check && pnpm run lint:md && pnpm pack --dry-run',
    );
  });

  it("packs every runtime-control consumer entry with ESM and NodeNext declarations", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      exports: Record<string, { types?: string; import?: string; default?: string }>;
    };
    for (const [subpath, target] of [
      [".", "index"],
      ["./core/runtime", "core/runtime/index"],
      ["./core/runtime/providers", "core/runtime/providers/index"],
      ["./providers/hermes", "providers/hermes/index"],
      ["./extensions/cavi", "extensions/cavi/index"],
      ["./testing", "testing/index"],
    ] as const) {
      expect(packageJson.exports[subpath]).toEqual({
        types: `./dist/${target}.d.ts`,
        import: `./dist/${target}.js`,
        default: `./dist/${target}.js`,
      });
    }
    const packageJsonWithScripts = packageJson as typeof packageJson & { scripts?: Record<string, string> };
    expect(packageJsonWithScripts.scripts?.["test:packed-consumer"]).toBe(
      "node scripts/test-packed-consumer.mjs",
    );
    const packedConsumerScript = read(path.join(PACKAGE_ROOT, "scripts/test-packed-consumer.mjs"));
    for (const specifier of [
      "@cavi-ai/api-client",
      "@cavi-ai/api-client/core/runtime",
      "@cavi-ai/api-client/core/runtime/providers",
      "@cavi-ai/api-client/providers/hermes",
      "@cavi-ai/api-client/extensions/cavi",
      "@cavi-ai/api-client/testing",
    ]) expect(packedConsumerScript).toContain(specifier);
    expect(packedConsumerScript).toContain('"moduleResolution": "NodeNext"');
    expect(packedConsumerScript).toContain("--ignore-scripts");
  });

  it("keeps dist free of stale compiled modules", () => {
    const offenders = walkFilesIfExists(DIST_ROOT)
      .filter((filePath) => /\.(?:js|d\.ts)$/u.test(filePath))
      .filter((filePath) => {
        const candidates = sourceCandidatesForDistArtifact(filePath);
        return candidates.length > 0 && !candidates.some((candidate) => existsSync(candidate));
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps React bindings under strict TypeScript", () => {
    const reactSource = read(REACT_GATEWAY_PROVIDER);
    expect(reactSource).not.toMatch(/@ts-nocheck/u);
    for (const optionName of [
      "GatewayClientOverrideOptions",
      "defaultRequestedScopes",
      "preauthHandshakeEnvKeys",
      "requestTimeoutMs",
      "maxConcurrentRequests",
      "minProtocol",
      "maxProtocol",
    ]) {
      expect(reactSource).toContain(optionName);
    }
  });

  it("points the package root at canonical implementation folders", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      exports: Record<string, unknown>;
    };

    expect(read(path.join(SRC_ROOT, "index.ts"))).not.toMatch(
      ROOT_INDEX_FORBIDDEN_SHIM_EXPORT_RE,
    );
    expect(read(path.join(SRC_ROOT, "index.ts"))).not.toMatch(
      PROVIDER_FACTORY_ROOT_EXPORT_RE,
    );
    expect(packageJson.exports["./core/gateway"]).toEqual({
      types: "./dist/core/gateway/index.d.ts",
      import: "./dist/core/gateway/index.js",
      default: "./dist/core/gateway/index.js",
    });
    expect(read(CORE_GATEWAY_INDEX).trim()).toBe([
      'export * from "./client/index.js";',
      'export * from "./agent/index.js";',
      'export * from "./run/index.js";',
      'export * from "./rpc/index.js";',
      'export * from "./snapshots/index.js";',
      'export * from "./resources/index.js";',
      'export * from "./envelope/index.js";',
      'export * from "./portal/index.js";',
      'export * from "./providers/index.js";',
      'export * from "./jobs.js";',
    ].join("\n"));
  });

  it("publishes isolated universal and Node transport subpaths", () => {
    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      exports: Record<string, unknown>;
    };

    expect(packageJson.exports["./core/transport"]).toEqual({
      types: "./dist/core/transport/index.d.ts",
      import: "./dist/core/transport/index.js",
      default: "./dist/core/transport/index.js",
    });
    expect(packageJson.exports["./core/transport/node"]).toEqual({
      types: "./dist/core/transport/node/index.d.ts",
      import: "./dist/core/transport/node/index.js",
      default: "./dist/core/transport/node/index.js",
    });

    for (const entry of [path.join(SRC_ROOT, "index.ts"), CORE_TRANSPORT_INDEX]) {
      const offenders = relativeImportGraph(entry)
        .flatMap((filePath) => staticNodeSpecifiers(read(filePath), filePath).map(
          (specifier) => `${rel(filePath)} -> ${specifier}`,
        ));
      expect(offenders, `${rel(entry)} reaches Node built-ins`).toEqual([]);
    }
    expect(read(path.join(SRC_ROOT, "index.ts"))).not.toContain("core/transport/node");
    expect(read(CORE_TRANSPORT_NODE_INDEX)).toContain('export * from "./stdio.js";');
    expect(read(CORE_TRANSPORT_NODE_INDEX)).toContain('export * from "./unix-socket.js";');
  });

  it("finds static Node imports reached only through re-export barrels", () => {
    const graph = relativeImportGraph(TRANSPORT_NODE_REEXPORT_FIXTURE);
    const nodeSpecifiers = graph.flatMap((filePath) =>
      staticNodeSpecifiers(read(filePath), filePath));

    expect(graph.map((filePath) => path.basename(filePath)).sort()).toEqual([
      "barrel.ts",
      "entry.ts",
      "leaf.ts",
    ]);
    expect(nodeSpecifiers).toEqual(["node:fs"]);
    expect(staticModuleSpecifiers(read(path.join(
      path.dirname(TRANSPORT_NODE_REEXPORT_FIXTURE),
      "leaf.ts",
    )))).not.toContain("node:path");
  });

  it("keeps core gateway independent from CAVI and provider implementations", () => {
    const offenders = walkFiles(path.join(SRC_ROOT, "core"))
      .filter((filePath) => {
        const source = read(filePath);
        return /from\s+["'][^"']*(?:(?:\.\.\/)+providers\/|extensions\/cavi|cavi\/)/u.test(source);
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps providers independent from CAVI extensions (except team-registry wrappers)", () => {
    // providers/* and extensions/cavi are siblings over core+contracts; a provider
    // must not import extensions/cavi. The only sanctioned exception is the thin
    // team-registry wrapper set (documented in CLAUDE.md).
    const offenders = walkFiles(path.join(SRC_ROOT, "providers"))
      .filter((filePath) => /\.tsx?$/u.test(filePath) && !/\.test\.tsx?$/u.test(filePath))
      .filter((filePath) => !PROVIDER_EXTENSION_IMPORT_ALLOWLIST.has(rel(filePath)))
      .filter((filePath) => /from\s+["'][^"']*extensions\/cavi/u.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps generic transport and snapshot implementations in core", () => {
    const offenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/extensions/cavi/"))
      .filter((filePath) => /^(?:transport|snapshot)\.ts$/u.test(path.basename(filePath)))
      .map(rel)
      .filter((relative) => !CAVI_GENERIC_IMPLEMENTATION_FILENAME_ALLOWLIST.has(relative));

    expect(offenders).toEqual([]);
  });

  it("keeps contracts independent from providers and extensions", () => {
    // contracts/ sits below extensions/cavi and providers/ in the dependency
    // direction (core -> contracts -> extensions/cavi -> providers/frameworks).
    // A contracts/** file must never import upward. Mirrors the core-gateway
    // and providers import-direction tests above.
    const offenders = walkFiles(path.join(SRC_ROOT, "contracts"))
      .filter((filePath) => {
        const source = read(filePath);
        return /from\s+["'][^"']*(?:(?:\.\.\/)+providers\/|(?:\.\.\/)+extensions\/)/u.test(source);
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps provider resolution out of core gateway", () => {
    expect(existsSync(CORE_GATEWAY_PROVIDER)).toBe(false);
    for (const file of ["provider.js", "provider.d.ts", "provider.d.ts.map"]) {
      expect(existsSync(path.join(DIST_CORE_GATEWAY_ROOT, file))).toBe(false);
    }
  });

  it("keeps provider-specific env naming out of core config", () => {
    expect(read(CORE_ENV_CONFIG)).not.toMatch(/\bhermes\b|HERMES_/iu);
    expect(read(CORE_HTTP_TYPES)).not.toContain("hermes-api-server");
  });

  it("keeps provider names and handshake env keys out of core RPC", () => {
    // Core RPC must stay provider-agnostic everywhere — not just env keys, but
    // identifiers, string literals, and comments. Provider-specific protocol
    // quirks (e.g. the connect-frame-id strategy) belong in providers/*, which
    // opt in through neutral GatewayRpcClientOptions.
    const offenders = walkFiles(path.join(SRC_ROOT, "core", "gateway", "rpc"))
      .filter((filePath) => /\.tsx?$/u.test(filePath))
      .filter((filePath) => /\b(?:openclaw|hermes)\b/iu.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);

    const rpcSources = [
      path.join(SRC_ROOT, "core", "gateway", "rpc", "client.ts"),
      path.join(SRC_ROOT, "core", "gateway", "rpc", "preauth-handshake.ts"),
    ].map(read).join("\n");

    expect(rpcSources).not.toMatch(/OPENCLAW_/u);
  });

  it("keeps provider-specific agent config compatibility out of core", () => {
    const coreSource = read(CORE_GATEWAY_AGENT_CONFIG);
    const hermesSource = read(path.join(SRC_ROOT, "providers", "hermes", "agent-config.ts"));

    expect(coreSource).not.toMatch(/\b(?:Hermes|hermes|WebUI|webui)\b/u);
    expect(hermesSource).toContain("HERMES_PROFILE_COOKIE_NAME");
    expect(hermesSource).toContain("buildAgentConfigFromHermesWebuiSnapshot");
  });

  it("keeps gateway implementations in owner folders without flat shims", () => {
    const expectedOwnerFiles = [
      "src/core/gateway/README.md",
      "src/core/gateway/index.ts",
      "src/core/gateway/client/index.ts",
      "src/core/gateway/client/client.ts",
      "src/core/gateway/client/error-details.ts",
      "src/core/gateway/client/fetch.ts",
      "src/core/gateway/client/runtime-targets.ts",
      "src/core/gateway/agent/index.ts",
      "src/core/gateway/agent/commands.ts",
      "src/core/gateway/agent/config.ts",
      "src/core/gateway/agent/voice-config.ts",
      "src/core/gateway/run/index.ts",
      "src/core/gateway/run/contracts.ts",
      "src/core/gateway/run/event-stream.ts",
      "src/core/gateway/run/sse-run-event-provider.ts",
      "src/core/gateway/run/stream-failure.ts",
      "src/core/gateway/snapshots/index.ts",
      "src/core/gateway/snapshots/cache.ts",
      "src/core/gateway/snapshots/loaders.ts",
      "src/core/gateway/snapshots/session-loaders.ts",
      "src/core/gateway/snapshots/system-loaders.ts",
      "src/core/gateway/snapshots/transforms.ts",
      "src/core/gateway/rpc/index.ts",
      "src/core/gateway/rpc/client.ts",
      "src/core/gateway/rpc/device-crypto.ts",
      "src/core/gateway/rpc/device-store.ts",
      "src/core/gateway/rpc/error.ts",
      "src/core/gateway/rpc/preauth-handshake.ts",
      "src/core/gateway/portal/index.ts",
      "src/core/gateway/portal/config-patch.ts",
      "src/core/gateway/envelope/index.ts",
      "src/core/gateway/envelope/envelope.ts",
      "src/core/gateway/envelope/types.ts",
      "src/core/gateway/resources/index.ts",
      "src/core/gateway/resources/media.ts",
      "src/core/gateway/resources/wiki.ts",
    ];
    const oldFlatGatewayFiles = [
      "src/core/gateway/client.ts",
      "src/core/gateway/error-details.ts",
      "src/core/gateway/fetch.ts",
      "src/core/gateway/runtime-targets.ts",
      "src/core/gateway/agent-commands.ts",
      "src/core/gateway/agent-config.ts",
      "src/core/gateway/agent-voice-config.ts",
      "src/core/gateway/run-event-stream.ts",
      "src/core/gateway/run-stream-contracts.ts",
      "src/core/gateway/sse-run-event-provider.ts",
      "src/core/gateway/stream-failure.ts",
      "src/core/gateway/session-loaders.ts",
      "src/core/gateway/snapshot-loaders.ts",
      "src/core/gateway/system-loaders.ts",
      "src/core/gateway/transforms.ts",
      "src/core/gateway/rpc.ts",
      "src/core/gateway/rpc-error.ts",
      "src/core/gateway/device-crypto.ts",
      "src/core/gateway/device-store.ts",
      "src/core/gateway/preauth-handshake.ts",
      "src/core/gateway/portal-config-patch.ts",
      "src/core/gateway/envelope.ts",
      "src/core/gateway/envelope-types.ts",
      "src/core/gateway/cache.ts",
      "src/core/gateway/media.ts",
      "src/core/gateway/wiki.ts",
    ];

    expect(expectedOwnerFiles.filter((relative) =>
      !existsSync(path.join(PACKAGE_ROOT, relative)),
    )).toEqual([]);
    expect(read(path.join(CORE_GATEWAY_ROOT, "README.md"))).toMatch(
      /Gateway implementation lives in folder-owned modules/u,
    );
    for (const relative of oldFlatGatewayFiles) {
      const activeSource = path.join(PACKAGE_ROOT, relative);
      const basename = path.basename(relative, ".ts");

      expect(existsSync(activeSource)).toBe(false);
      for (const suffix of [".js", ".d.ts", ".d.ts.map"]) {
        const distFile = path.join(DIST_CORE_GATEWAY_ROOT, `${basename}${suffix}`);
        expect(existsSync(distFile)).toBe(false);
      }
    }
    const flatGatewayImportOffenders = productionSourceFiles()
      .filter((filePath) => CORE_GATEWAY_COMPAT_BARREL_IMPORT_RE.test(read(filePath)))
      .map(rel);

    expect(flatGatewayImportOffenders).toEqual([]);
  });

  it("keeps production code independent from test fixtures", () => {
    const offenders = productionSourceFiles()
      .filter((filePath) => /from\s+["'][^"']*(?:test-support|__tests__)\//u.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps runtime CAVI fallbacks out of mock-data paths", () => {
    const offenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/extensions/cavi/"))
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
      .filter((filePath) => rel(filePath).startsWith("src/extensions/cavi/"))
      .filter((filePath) => /["'][^"']*(?:cavi\/data|(?:\.\.\/)+data\/)/u.test(read(filePath)))
      .map(rel);

    expect(walkFilesIfExists(CAVI_DATA_ROOT).map(rel)).toEqual([]);
    expect(existsSync(CAVI_DATA_LIB_ROOT)).toBe(false);
    expect(importOffenders).toEqual([]);
  });

  it("does not keep CAVI core re-export shims in active source", () => {
    const importOffenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/extensions/cavi/"))
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
      .filter((filePath) => rel(filePath).startsWith("src/extensions/cavi/"))
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
    const gatewaySseSource = read(path.join(SRC_ROOT, "core", "gateway", "run", "sse-run-event-provider.ts"));

    expect(read(CORE_SSE_INDEX)).toContain('export * from "./stream.js";');
    expect(packageJson.exports["./core/sse"]).toEqual({
      types: "./dist/core/sse/index.d.ts",
      import: "./dist/core/sse/index.js",
      default: "./dist/core/sse/index.js",
    });
    expect(gatewaySseSource).toContain('from "../../sse/index.js";');
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
    const expectedProviderFiles = [
      "factory.ts",
      "index.ts",
      "normalize.ts",
      "registry.ts",
      "types.ts",
    ];
    const providerSpecificFiles = ["factory.ts", "normalize.ts", "registry.ts", "types.ts"];

    expect(packageJson.exports["./providers/hermes"]).toEqual({
      types: "./dist/providers/hermes/index.d.ts",
      import: "./dist/providers/hermes/index.js",
      default: "./dist/providers/hermes/index.js",
    });
    expect(packageJson.exports["./providers/openclaw"]).toEqual({
      types: "./dist/providers/openclaw/index.d.ts",
      import: "./dist/providers/openclaw/index.js",
      default: "./dist/providers/openclaw/index.js",
    });
    expect(packageJson.exports["./providers/codex"]).toEqual({
      types: "./dist/providers/codex/index.d.ts",
      import: "./dist/providers/codex/index.js",
      default: "./dist/providers/codex/index.js",
    });
    expect(packageJson.exports["./providers/gemini"]).toEqual({
      types: "./dist/providers/gemini/index.d.ts",
      import: "./dist/providers/gemini/index.js",
      default: "./dist/providers/gemini/index.js",
    });
    expect(read(path.join(SRC_ROOT, "index.ts"))).toContain(
      'from "./core/gateway/providers/index.js"',
    );
    expect(expectedProviderFiles.filter((file) =>
      !existsSync(path.join(CORE_GATEWAY_PROVIDERS_ROOT, file)),
    )).toEqual([]);
    const providerTypes = read(path.join(CORE_GATEWAY_PROVIDERS_ROOT, "types.ts"));
    // Runtime/Gateway split: the universal RuntimeProviderModule is the base, and
    // GatewayProviderModule extends it plus the gateway factory surface.
    expect(providerTypes).toContain("export interface RuntimeProviderModule");
    expect(providerTypes).toContain("export interface GatewayProviderModule");
    expect(providerTypes).toMatch(
      /GatewayProviderModule[\s\S]*?extends[\s\S]*?RuntimeProviderModule[\s\S]*?GatewayProviderFactories/u,
    );
    expect(providerSpecificFiles.filter((file) =>
      /\b(?:Hermes|OpenClaw)\b/u.test(read(path.join(CORE_GATEWAY_PROVIDERS_ROOT, file))),
    )).toEqual([]);
    expect(read(path.join(SRC_ROOT, "providers", "hermes", "provider-module.ts"))).toContain(
      "HERMES_PROVIDER_MODULE",
    );
    expect(read(path.join(SRC_ROOT, "providers", "openclaw", "provider-module.ts"))).toContain(
      "OPENCLAW_PROVIDER_MODULE",
    );
    expect(read(path.join(SRC_ROOT, "providers", "codex", "provider-module.ts"))).toContain(
      "createCodexProviderModule",
    );
  });

  it("keeps CAVI production modules on shared HTTP transports", () => {
    const offenders = productionSourceFiles()
      .filter((filePath) => rel(filePath).startsWith("src/extensions/cavi/"))
      .filter((filePath) => /\bfetch\s*\(/u.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("preserves matrix and runner-neutral control-plane exports without leaking provider adapters", () => {
    const rootIndex = read(path.join(SRC_ROOT, "index.ts"));
    const testingIndex = read(path.join(SRC_ROOT, "testing", "index.ts"));

    expect(rootIndex).toContain('from "./core/runtime/control-plane/index.js"');
    expect(testingIndex).toContain('export * from "./runtime-control-client-conformance.js"');
    expect(testingIndex).toContain('export * from "./raw-gateway-conformance.js"');
    expect(rootIndex).toContain('from "./providers/capability-matrix.js"');
    expect(rootIndex).toContain("RUNTIME_PROVIDER_CAPABILITY_MATRIX");
    expect(rootIndex).toContain("getRuntimeProviderCapabilityRow");
    expect(rootIndex).toContain("RuntimeProviderCapabilityMatrixKey");
    expect(rootIndex).toContain("RuntimeProviderCapabilityRow");
    expect(rootIndex).not.toMatch(/(?:CLAUDE|CODEX|GEMINI|HERMES|OPENCLAW)_PROVIDER_MODULE/u);
    expect(rootIndex).not.toContain("inspectRuntimeControlPlaneConformance");
    // RuntimeControlPlane was a second, implementer-less control-plane contract
    // alongside RuntimeControlClient. Neither it, its provider-module factory
    // slot, nor its conformance suite may return.
    expect(testingIndex).not.toContain("runtime-control-plane-conformance");
    expect(rootIndex).not.toMatch(/\bRuntimeControlPlane\b(?!Metadata|Event|Declaration)/u);
  });

  it("keeps provider-neutral runtime-control and testing code free of concrete raw transports", () => {
    const providerNeutralFiles = [
      ...walkFiles(path.join(SRC_ROOT, "core", "runtime", "control-plane")),
      path.join(SRC_ROOT, "testing", "raw-gateway-conformance.ts"),
    ];
    const concreteImport = /from\s+["'][^"']*(?:providers\/|extensions\/cavi\/providers\/|core\/(?:gateway\/rpc|ws|sse)(?:\/|(?:\.[cm]?[jt]s)?(?=["']))|core\/transport\/(?:websocket|sse|json-rpc)(?:\/|(?:\.[cm]?[jt]s)?(?=["'])))[^"']*["']/u;
    for (const directImport of [
      'import { x } from "../core/transport/websocket.js";',
      'import { x } from "../core/transport/sse.ts";',
      'import { x } from "../core/transport/json-rpc";',
      'import { x } from "../core/ws/index.js";',
      'import { x } from "../core/sse/stream.js";',
      'import { x } from "../core/gateway/rpc/error.js";',
    ]) expect(concreteImport.test(directImport)).toBe(true);
    const offenders = providerNeutralFiles
      .filter((filePath) => concreteImport.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("curates approved root additions without exporting transport factories", () => {
    const rootIndex = read(path.join(SRC_ROOT, "index.ts"));
    const originMainBaseline = JSON.parse(read(ROOT_EXPORT_BASELINE)) as string[];
    const expectedRootExports = [
      ...originMainBaseline,
      ...APPROVED_ROOT_TRANSPORT_ADDITIONS,
      ...APPROVED_ROOT_RUNTIME_CONTROL_CLIENT_ADDITIONS,
      ...APPROVED_ROOT_CAPABILITY_CONTRACT_ADDITIONS,
    ]
      .filter((name) => !APPROVED_ROOT_REMOVALS.has(name))
      .sort();

    expect(rootExportNames(path.join(SRC_ROOT, "index.ts"))).toEqual(expectedRootExports);
    for (const factory of [
      "createHttpTransport",
      "createJsonRpcTransport",
      "createSseTransport",
      "createWebSocketTransport",
      "createStdioTransport",
      "createUnixSocketTransport",
    ]) {
      expect(rootIndex, `root must not export ${factory}`).not.toContain(factory);
    }
    expect(rootIndex).toContain("RUNTIME_PROVIDER_CAPABILITY_MATRIX");
    expect(rootIndex).toContain("getRuntimeProviderCapabilityRow");
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
  });

  it("does not bake CAVI fleet-agent slugs into the extension contracts", () => {
    const caviContracts = walkFiles(
      path.join(SRC_ROOT, "extensions", "cavi", "contracts"),
    ).filter((filePath) => filePath.endsWith(".ts"));
    const offenders = caviContracts
      .filter((filePath) => FLEET_SLUG_RE.test(read(filePath)))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("keeps team registry data runtime-supplied instead of baked into the package", () => {
    const offenders = TEAM_REGISTRY_OWNER_FILES.filter((relativePath) =>
      FLEET_SLUG_RE.test(read(path.join(PACKAGE_ROOT, relativePath))),
    );

    expect(offenders).toEqual([]);
    expect(read(path.join(SRC_ROOT, "index.ts"))).not.toContain(
      "CAVI_TEAM_PORTAL_IDS",
    );
    expect(TEAM_REGISTRY_CONFIG.teams).toEqual([]);
    expect(createHermesTeamRegistry().listTeams()).toEqual([]);
    expect(createOpenClawTeamRegistry().listTeams()).toEqual([]);
  });

  it("keeps the team manifest contract agnostic and CAVI registry logic in the extension", () => {
    const manifestSource = read(TEAM_MANIFEST_CONTRACT);
    expect(manifestSource).not.toMatch(/extensions\/cavi|providers\/|Hermes|OpenClaw|Martina|Deb/u);
    expect(read(CAVI_TEAM_REGISTRY)).toContain("../../../contracts/team-manifest.js");
    expect(existsSync(path.join(SRC_ROOT, "core", "gateway", "team-registry.ts"))).toBe(false);
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

  it("composes extension surface paths over the core resolver", () => {
    const resolveWithCavi = createSurfacePathResolver(CAVI_SURFACE_CONTRACTS);

    expect(resolveWithCavi("gateway.health")).toBe(
      resolvePath("gateway.health"),
    );
    expect(resolveWithCavi("cavi.operator.snapshot")).toBe(
      resolveCaviPath("cavi.operator.snapshot"),
    );
    expect(() => resolvePath("cavi.operator.snapshot")).toThrow(
      /unknown surface/u,
    );
  });

  it("appends extension paths without allowing traversal or query smuggling", () => {
    expect(appendCaviApiPath("/api/plugins/demo", "cards")).toBe(
      "/api/plugins/demo/cards",
    );
    expect(appendCaviApiPath("/api/plugins/demo", "/cards/detail")).toBe(
      "/api/plugins/demo/cards/detail",
    );
    expect(appendCaviApiPath("/api/plugins/demo", "/api/plugins/demo/cards")).toBe(
      "/api/plugins/demo/cards",
    );
    expect(resolvePortalApiPath("machine", "dashboard")).toBe(
      "/api/plugins/portal/machine/dashboard",
    );
    expect(resolvePluginApiPath("machine", "dashboard")).toBe(
      "/api/plugins/machine/dashboard",
    );
    expect(resolveLibraryApiPath("status")).toBe("/api/plugins/library/status");
    expect(resolveLibraryApiPath("/api/plugins/library/status")).toBe(
      "/api/plugins/library/status",
    );
    expect(() => appendCaviApiPath("/api/plugins/demo", "../secret")).toThrow(
      /stay within base path/u,
    );
    expect(() => appendCaviApiPath("/api/plugins/demo", "%2e%2e/secret")).toThrow(
      /stay within base path/u,
    );
    expect(() => appendCaviApiPath("/api/plugins/demo", "cards?limit=1")).toThrow(
      /appendHttpQuery/u,
    );
    expect(() => appendCaviApiPath("//api/plugins/demo", "cards")).toThrow(
      /basePath/u,
    );
    expect(() => resolveLibraryApiPath("../status")).toThrow(
      /stay within base path/u,
    );
    expect(() => resolvePortalApiPath("machine", "media\\images")).toThrow(
      /backslashes/u,
    );
  });

  it("keeps surface contract keys and critical canonical paths aligned", () => {
    const mismatchedKeys = Object.entries(SURFACE_CONTRACTS)
      .filter(([key, contract]) => contract.key !== key)
      .map(([key, contract]) => `${key} -> ${contract.key}`);

    expect(mismatchedKeys).toEqual([]);
    const mismatchedCaviKeys = Object.entries(CAVI_SURFACE_CONTRACTS)
      .filter(([key, contract]) => contract.key !== key)
      .map(([key, contract]) => `${key} -> ${contract.key}`);

    expect(mismatchedCaviKeys).toEqual([]);
    expect(resolveCaviPath("cavi.operator.tasks")).toBe(
      "/cavi-control/api/operator/tasks",
    );
    expect(resolveCaviPath("cavi.operator.snapshot")).toBe(
      "/cavi-control/api/operator/snapshot",
    );
    expect(resolveCaviPath("portalMemory.snapshot", {
      teamSlug: "machine",
      memberId: "chris",
      memoryKey: "comedy-room",
    })).toBe("/api/plugins/portal-memory/teams/machine/members/chris/comedy-room");
    expect(portalConfigPatchPath("martina")).toBe(
      resolveCaviPath("portal.config", { portal: "martina" }),
    );
  });

  it("resolves repo roots only from explicit or REPO_ROOT-backed inputs", () => {
    expect(resolveRepoRoot({ repoRoot: " /workspace/project/ " })).toBe("/workspace/project");
    expect(resolveRepoRoot({ env: { REPO_ROOT: "/workspace/from-env/" } })).toBe("/workspace/from-env");

    // resolveRepoRoot falls back to the ambient process.env as a last resort, so
    // this assertion must clear it to stay hermetic on dev machines that export REPO_ROOT.
    const priorRepoRoot = process.env.REPO_ROOT;
    delete process.env.REPO_ROOT;
    try {
      expect(() => requireRepoRoot({ env: {} })).toThrow(/Missing REPO_ROOT/u);
    } finally {
      if (priorRepoRoot === undefined) {
        delete process.env.REPO_ROOT;
      } else {
        process.env.REPO_ROOT = priorRepoRoot;
      }
    }
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
    expect(media.endpoints.generate("image")).toBe("/v1/media/image/generate");
    expect(wiki.surface).toBe("gateway-wiki-api");
    expect(wiki.endpoints.compile("research")).toBe("/v1/wiki/vaults/research/compile");
  });

  it("selects gateway implementations by explicit provider or env", () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))) as typeof fetch;
    const hermes = createGatewayApiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclaw = createGatewayApiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { env: { CAVI_GATEWAY_PROVIDER: "openclaw" }, providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const hermesMedia = createGatewayMediaClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclawMedia = createGatewayMediaClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const hermesWiki = createGatewayWikiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclawWiki = createGatewayWikiClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const hermesAgentConfig = createGatewayAgentConfigClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclawAgentConfig = createGatewayAgentConfigClient(
      { baseUrl: "https://gateway.example", fetchImpl },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
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
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclawWs = createGatewayWebSocketClient(
      "wss://gateway.example/ws",
      "token",
      { clientId: "client-1" },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
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
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclawSse = createGatewaySseRunEventProvider(
      {
        httpBase: "https://gateway.example",
        authToken: "token",
        clientId: "client-1",
      },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
    );

    expect(resolveGatewayProviderKind({ env: { GATEWAY_PROVIDER: "generic" } })).toBe("gateway");
    expect(GATEWAY_PROVIDER_ENV_KEYS).toEqual(["CAVI_GATEWAY_PROVIDER", "GATEWAY_PROVIDER"]);
    expect(resolveGatewayProviderKind({ provider: "open-claw", providerModules: BUILT_IN_PROVIDER_MODULES })).toBe("openclaw");
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
    expect(hermesAgentConfig).toBeInstanceOf(HermesAgentConfigApiClient);
    expect(hermesAgentConfig.surface).toBe("hermes-agent-config-api");
    expect(openclawAgentConfig).toBeInstanceOf(OpenClawAgentConfigApiClient);
    expect(openclawAgentConfig.surface).toBe("openclaw-agent-config-api");
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
    expect(createGatewayProviderRegistry({
      modules: [{ kind: "gateway" }],
    }).resolveProvider("generic")?.kind).toBe("gateway");
    expect(() => createGatewayProviderRegistry({
      modules: [{ kind: "gateway" }, { kind: "generic" }],
    })).toThrow('Duplicate provider key "gateway"');
  });

  it("keeps Codex as a runtime-only provider module", () => {
    const module = createCodexProviderModule({ apiKey: "sk-test" });
    const client = module.createApiClient?.({ baseUrl: "https://api.openai.com" });

    expect(module.kind).toBe("codex-responses");
    expect(module.capabilities?.runs).toBe(true);
    expect(module.capabilities?.streaming).toBe(true);
    expect(client).toBeInstanceOf(CodexApiClient);
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

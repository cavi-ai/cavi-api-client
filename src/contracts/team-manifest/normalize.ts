import { invalidConfigError } from "../../core/error-factories.js";
import {
  TEAM_MANIFEST_VERSION,
  DEFAULT_TEAM_ID,
  DEFAULT_TEAM_MEMBER_ID,
  TEAM_ACTION_INPUT_MODES,
  TEAM_ACTION_OUTPUT_MODES,
} from "./types.js";
import type {
  TeamActionInputMode,
  TeamActionOutputMode,
  TeamActionHttpMethod,
  TeamActionParamType,
  TeamActionJsonValue,
  TeamRouteKey,
  ManifestIdentity,
  TeamWorkspacePathEntry,
  TeamWorkspaceConfig,
  TeamActionParamContract,
  TeamActionInputContract,
  TeamActionArtifactContract,
  TeamActionOutputContract,
  TeamActionRouteContract,
  TeamActionContract,
  ManifestMember,
  ManifestRouteConfig,
  ManifestTeam,
  GatewayRouteBinding,
  TeamManifest,
  CreateDefaultTeamManifestOptions,
} from "./types.js";

export type NormalizedWorkspacePathEntry = {
  key: string;
  path: string;
};

export function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function requiredText(value: string | null | undefined, label: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw invalidConfigError(`team manifest: missing ${label}`);
  }
  return trimmed;
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function uniqueStrings(values: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values ?? []) {
    const trimmed = nonEmpty(value);
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeActionInputMode(
  value: TeamActionInputMode | null | undefined,
): TeamActionInputMode | null {
  const mode = nonEmpty(value);
  if (!mode) {
    return null;
  }
  if (!TEAM_ACTION_INPUT_MODES.includes(mode as TeamActionInputMode)) {
    throw invalidConfigError(`team manifest: invalid action input mode "${mode}"`);
  }
  return mode as TeamActionInputMode;
}

function normalizeActionOutputMode(
  value: TeamActionOutputMode | null | undefined,
): TeamActionOutputMode | null {
  const mode = nonEmpty(value);
  if (!mode) {
    return null;
  }
  if (!TEAM_ACTION_OUTPUT_MODES.includes(mode as TeamActionOutputMode)) {
    throw invalidConfigError(`team manifest: invalid action output mode "${mode}"`);
  }
  return mode as TeamActionOutputMode;
}

function normalizeActionParamType(
  value: TeamActionParamType | null | undefined,
): TeamActionParamType | null {
  const type = nonEmpty(value);
  if (!type) {
    return null;
  }
  switch (type) {
    case "boolean":
    case "enum":
    case "file":
    case "json":
    case "number":
    case "string":
      return type;
    default:
      throw invalidConfigError(`team manifest: invalid action param type "${type}"`);
  }
}

function normalizeActionHttpMethod(
  value: TeamActionHttpMethod | null | undefined,
): TeamActionHttpMethod | null {
  const method = nonEmpty(value)?.toUpperCase();
  if (!method) {
    return null;
  }
  switch (method) {
    case "DELETE":
    case "GET":
    case "PATCH":
    case "POST":
    case "PUT":
      return method;
    default:
      throw invalidConfigError(`team manifest: invalid action route method "${method}"`);
  }
}

function normalizeActionDefaults(
  defaults: Record<string, TeamActionJsonValue> | null | undefined,
): Record<string, TeamActionJsonValue> | null {
  if (!defaults) {
    return null;
  }
  const normalized: Record<string, TeamActionJsonValue> = {};
  for (const [key, value] of Object.entries(defaults)) {
    const normalizedKey = nonEmpty(key);
    if (normalizedKey) {
      normalized[normalizedKey] = value;
    }
  }
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeActionParamContract(
  param: TeamActionParamContract,
): TeamActionParamContract {
  return {
    key: requiredText(param.key, "action param key"),
    ...(normalizeActionParamType(param.type)
      ? { type: normalizeActionParamType(param.type) }
      : {}),
    ...(param.required !== undefined && param.required !== null
      ? { required: Boolean(param.required) }
      : {}),
    ...(hasOwn(param, "default") ? { default: param.default } : {}),
    values: uniqueStrings(param.values),
    aliases: uniqueStrings(param.aliases),
    ...(nonEmpty(param.description)
      ? { description: nonEmpty(param.description) }
      : {}),
    ...(param.metadata ? { metadata: param.metadata } : {}),
  };
}

function normalizeActionParams(
  params: readonly TeamActionParamContract[] | null | undefined,
): TeamActionParamContract[] {
  const seen = new Set<string>();
  const normalized: TeamActionParamContract[] = [];
  for (const param of params ?? []) {
    const entry = normalizeActionParamContract(param);
    if (seen.has(entry.key)) {
      throw invalidConfigError(`team manifest: duplicate action param "${entry.key}"`);
    }
    seen.add(entry.key);
    normalized.push(entry);
  }
  return normalized;
}

function normalizeActionInputContract(
  input: TeamActionInputContract | null | undefined,
): TeamActionInputContract | null {
  if (!input) {
    return null;
  }
  return {
    ...(normalizeActionInputMode(input.mode)
      ? { mode: normalizeActionInputMode(input.mode) }
      : {}),
    ...(nonEmpty(input.command) ? { command: nonEmpty(input.command) } : {}),
    params: normalizeActionParams(input.params),
    ...(input.schema ? { schema: input.schema } : {}),
    examples: uniqueStrings(input.examples),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

function normalizeActionArtifactContract(
  artifact: TeamActionArtifactContract,
): TeamActionArtifactContract {
  return {
    key: requiredText(artifact.key, "action artifact key"),
    ...(nonEmpty(artifact.contentType)
      ? { contentType: nonEmpty(artifact.contentType) }
      : {}),
    ...(nonEmpty(artifact.path) ? { path: nonEmpty(artifact.path) } : {}),
    ...(nonEmpty(artifact.description)
      ? { description: nonEmpty(artifact.description) }
      : {}),
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
  };
}

function normalizeActionArtifacts(
  artifacts: readonly TeamActionArtifactContract[] | null | undefined,
): TeamActionArtifactContract[] {
  const seen = new Set<string>();
  const normalized: TeamActionArtifactContract[] = [];
  for (const artifact of artifacts ?? []) {
    const entry = normalizeActionArtifactContract(artifact);
    if (seen.has(entry.key)) {
      throw invalidConfigError(`team manifest: duplicate action artifact "${entry.key}"`);
    }
    seen.add(entry.key);
    normalized.push(entry);
  }
  return normalized;
}

function normalizeActionOutputContract(
  output: TeamActionOutputContract | null | undefined,
): TeamActionOutputContract | null {
  if (!output) {
    return null;
  }
  return {
    ...(normalizeActionOutputMode(output.mode)
      ? { mode: normalizeActionOutputMode(output.mode) }
      : {}),
    ...(nonEmpty(output.contentType)
      ? { contentType: nonEmpty(output.contentType) }
      : {}),
    ...(output.schema ? { schema: output.schema } : {}),
    artifacts: normalizeActionArtifacts(output.artifacts),
    ...(output.metadata ? { metadata: output.metadata } : {}),
  };
}

function normalizeActionRouteContract(
  route: TeamActionRouteContract | null | undefined,
): TeamActionRouteContract | null {
  if (!route) {
    return null;
  }
  const path = nonEmpty(route.path);
  return {
    ...(normalizeActionHttpMethod(route.method)
      ? { method: normalizeActionHttpMethod(route.method) }
      : {}),
    ...(nonEmpty(route.surfaceKey) ? { surfaceKey: nonEmpty(route.surfaceKey) } : {}),
    ...(path ? { path: normalizeAbsoluteApiPath(path, "action route path") } : {}),
    ...(route.metadata ? { metadata: route.metadata } : {}),
  };
}

function normalizeTeamActionContract(action: TeamActionContract): TeamActionContract {
  const defaults = normalizeActionDefaults(action.defaults);
  return {
    id: requiredText(action.id, "action id"),
    ...(nonEmpty(action.title) ? { title: nonEmpty(action.title) } : {}),
    ...(nonEmpty(action.description)
      ? { description: nonEmpty(action.description) }
      : {}),
    ...(action.enabled !== undefined && action.enabled !== null
      ? { enabled: Boolean(action.enabled) }
      : {}),
    ...(action.route ? { route: normalizeActionRouteContract(action.route) } : {}),
    ...(action.input ? { input: normalizeActionInputContract(action.input) } : {}),
    ...(action.output ? { output: normalizeActionOutputContract(action.output) } : {}),
    ...(defaults ? { defaults } : {}),
    capabilities: uniqueStrings(action.capabilities),
    ...(action.metadata ? { metadata: action.metadata } : {}),
  };
}

function normalizeTeamActionContracts(
  actions: readonly TeamActionContract[] | null | undefined,
): TeamActionContract[] {
  const seen = new Set<string>();
  const normalized: TeamActionContract[] = [];
  for (const action of actions ?? []) {
    const entry = normalizeTeamActionContract(action);
    if (seen.has(entry.id)) {
      throw invalidConfigError(`team manifest: duplicate action "${entry.id}"`);
    }
    seen.add(entry.id);
    normalized.push(entry);
  }
  return normalized;
}

function pathSegment(value: string, label: string): string {
  const segment = requiredText(value, label);
  const decoded = decodePathSegment(segment);
  if (
    segment === "." ||
    segment === ".." ||
    decoded === "." ||
    decoded === ".." ||
    /[/?#\\]/u.test(segment) ||
    /[/?#\\]/u.test(decoded)
  ) {
    throw invalidConfigError(`team manifest: invalid ${label}: ${segment}`);
  }
  return encodeURIComponent(segment);
}

function normalizeRelativePath(value: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw invalidConfigError("team manifest: missing workspace path");
  }
  if (
    /^[a-z][a-z0-9+.-]*:/iu.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.includes("\\")
  ) {
    throw invalidConfigError(`team manifest: workspace path must be relative: ${trimmed}`);
  }
  const segments = trimmed
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => {
      const decoded = decodePathSegment(segment);
      return (
        segment === "." ||
        segment === ".." ||
        decoded === "." ||
        decoded === ".." ||
        decoded.includes("/") ||
        decoded.includes("\\")
      );
    })
  ) {
    throw invalidConfigError(`team manifest: invalid workspace path: ${trimmed}`);
  }
  return segments.join("/");
}

function normalizeAbsoluteApiPath(value: string, label: string): string {
  const trimmed = requiredText(value, label);
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/iu.test(trimmed) ||
    /[\\?#]/u.test(trimmed)
  ) {
    throw invalidConfigError(`team manifest: invalid ${label}: ${trimmed}`);
  }
  const segments = trimmed
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    throw invalidConfigError(`team manifest: invalid ${label}: ${trimmed}`);
  }
  for (const segment of segments) {
    const decoded = decodePathSegment(segment);
    if (
      segment === "." ||
      segment === ".." ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      throw invalidConfigError(`team manifest: invalid ${label}: ${trimmed}`);
    }
  }
  return `/${segments.join("/")}`;
}

function normalizeRootPath(value: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw invalidConfigError("team manifest: missing workspace rootPath");
  }
  return normalizeAbsoluteApiPath(trimmed, "workspace rootPath");
}

export function joinUrlPath(segments: readonly string[]): string {
  return `/${segments.map((segment) => pathSegment(segment, "path segment")).join("/")}`;
}

export function workspacePathSegments(value: string | null | undefined): string[] {
  return normalizeRelativePath(requiredText(value, "workspace path")).split("/");
}

export function joinWorkspacePath(rootPath: string, relativePath: string): string {
  return `${normalizeRootPath(rootPath)}/${normalizeRelativePath(relativePath)}`;
}

function normalizeWorkspacePathEntry(
  entry: TeamWorkspacePathEntry,
): NormalizedWorkspacePathEntry {
  if (typeof entry === "string") {
    const path = normalizeRelativePath(entry);
    return { key: path, path };
  }
  const key = nonEmpty(entry.key);
  if (!key) {
    throw invalidConfigError("team manifest: missing workspace path key");
  }
  return {
    key,
    path: normalizeRelativePath(entry.path ?? key),
  };
}

function normalizeWorkspaceConfig(
  workspace: TeamWorkspaceConfig | null | undefined,
): TeamWorkspaceConfig | null {
  if (!workspace) {
    return null;
  }
  return {
    rootPath: normalizeRootPath(workspace.rootPath),
    paths: (workspace.paths ?? []).map(normalizeWorkspacePathEntry),
  };
}

function normalizeIdentity(
  identity: ManifestIdentity | null | undefined,
): ManifestIdentity | null {
  if (!identity) {
    return null;
  }
  return {
    ...(nonEmpty(identity.name) ? { name: nonEmpty(identity.name) } : {}),
    ...(nonEmpty(identity.displayName)
      ? { displayName: nonEmpty(identity.displayName) }
      : {}),
    ...(nonEmpty(identity.slug) ? { slug: nonEmpty(identity.slug) } : {}),
    ...(nonEmpty(identity.code) ? { code: nonEmpty(identity.code) } : {}),
    aliases: uniqueStrings(identity.aliases),
    ...(identity.metadata ? { metadata: identity.metadata } : {}),
  };
}

function normalizeMember(member: ManifestMember): ManifestMember {
  return {
    id: requiredText(member.id, "member id"),
    ...(member.identity ? { identity: normalizeIdentity(member.identity) } : {}),
    ...(member.workspace
      ? { workspace: normalizeWorkspaceConfig(member.workspace) }
      : {}),
    actions: normalizeTeamActionContracts(member.actions),
    capabilities: uniqueStrings(member.capabilities),
    ...(member.metadata ? { metadata: member.metadata } : {}),
  };
}

function normalizeMembers(
  members: readonly ManifestMember[] | null | undefined,
): ManifestMember[] {
  const seen = new Set<string>();
  const normalized: ManifestMember[] = [];
  for (const member of members ?? []) {
    const entry = normalizeMember(member);
    if (seen.has(entry.id)) {
      throw invalidConfigError(`team manifest: duplicate member "${entry.id}"`);
    }
    seen.add(entry.id);
    normalized.push(entry);
  }
  return normalized;
}

function normalizeTeamRoutes(
  routes: readonly ManifestRouteConfig[] | null | undefined,
): ManifestRouteConfig[] {
  const seen = new Set<string>();
  const normalized: ManifestRouteConfig[] = [];
  for (const route of routes ?? []) {
    const key = requiredText(route.key, "route key");
    const routePath = nonEmpty(route.path);
    if (seen.has(key)) {
      throw invalidConfigError(`team manifest: duplicate route "${key}"`);
    }
    seen.add(key);
    normalized.push({
      key,
      ...(routePath
        ? { path: normalizeAbsoluteApiPath(routePath, "route path") }
        : {}),
    });
  }
  return normalized;
}

function normalizeTeam(team: ManifestTeam): ManifestTeam {
  return {
    id: requiredText(team.id, "team id"),
    ...(team.identity ? { identity: normalizeIdentity(team.identity) } : {}),
    members: normalizeMembers(team.members),
    ...(team.workspace ? { workspace: normalizeWorkspaceConfig(team.workspace) } : {}),
    actions: normalizeTeamActionContracts(team.actions),
    capabilities: uniqueStrings(team.capabilities),
    routes: normalizeTeamRoutes(team.routes),
    ...(team.metadata ? { metadata: team.metadata } : {}),
  };
}

function normalizeTeams(
  teams: readonly ManifestTeam[] | null | undefined,
): ManifestTeam[] {
  const seen = new Set<string>();
  const normalized: ManifestTeam[] = [];
  for (const team of teams ?? []) {
    const entry = normalizeTeam(team);
    if (seen.has(entry.id)) {
      throw invalidConfigError(`team manifest: duplicate team "${entry.id}"`);
    }
    seen.add(entry.id);
    normalized.push(entry);
  }
  return normalized;
}

function normalizeGatewayRouteBinding(
  binding: GatewayRouteBinding,
): GatewayRouteBinding {
  return {
    id: requiredText(binding.id, "gateway route binding id"),
    teamId: requiredText(binding.teamId, "gateway route binding teamId"),
    ...(nonEmpty(binding.memberId) ? { memberId: nonEmpty(binding.memberId) } : {}),
    ...(nonEmpty(binding.source) ? { source: nonEmpty(binding.source) } : {}),
    ...(nonEmpty(binding.channel) ? { channel: nonEmpty(binding.channel) } : {}),
    ...(nonEmpty(binding.actionId) ? { actionId: nonEmpty(binding.actionId) } : {}),
    ...(nonEmpty(binding.routeKey)
      ? { routeKey: nonEmpty(binding.routeKey) as TeamRouteKey }
      : {}),
    ...(nonEmpty(binding.sessionKeyPattern)
      ? { sessionKeyPattern: nonEmpty(binding.sessionKeyPattern) }
      : {}),
    ...(binding.metadata ? { metadata: binding.metadata } : {}),
  };
}

export function normalizeGatewayRouteBindings(
  bindings: readonly GatewayRouteBinding[] | null | undefined,
): GatewayRouteBinding[] {
  const seen = new Set<string>();
  const normalized: GatewayRouteBinding[] = [];
  for (const binding of bindings ?? []) {
    const entry = normalizeGatewayRouteBinding(binding);
    if (seen.has(entry.id)) {
      throw invalidConfigError(`team manifest: duplicate gateway route binding "${entry.id}"`);
    }
    seen.add(entry.id);
    normalized.push(entry);
  }
  return normalized;
}

export function findWorkspacePath(
  workspace: TeamWorkspaceConfig,
  keyOrPath: string,
): NormalizedWorkspacePathEntry | null {
  const requested = normalizeRelativePath(keyOrPath);
  for (const entry of workspace.paths ?? []) {
    const normalized = normalizeWorkspacePathEntry(entry);
    if (normalized.key === keyOrPath || normalized.path === requested) {
      return normalized;
    }
  }
  return null;
}

export function createDefaultTeamManifest(
  options: CreateDefaultTeamManifestOptions = {},
): TeamManifest {
  const teamId = nonEmpty(options.teamId) ?? DEFAULT_TEAM_ID;
  const memberId = nonEmpty(options.memberId) ?? DEFAULT_TEAM_MEMBER_ID;
  const workspace =
    options.workspaceRootPath !== undefined && options.workspaceRootPath !== null
      ? {
          rootPath: options.workspaceRootPath,
          paths: options.workspacePaths ?? [],
        }
      : null;

  return normalizeTeamManifest({
    version: TEAM_MANIFEST_VERSION,
    teams: [
      {
        id: teamId,
        identity: {
          name: teamId,
          displayName: teamId,
          slug: teamId,
          code: teamId,
        },
        members: [
          {
            id: memberId,
            ...(workspace ? { workspace } : {}),
          },
        ],
        ...(workspace ? { workspace } : {}),
      },
    ],
  });
}

export function normalizeTeamManifest(
  manifest: Partial<TeamManifest> | null | undefined,
): TeamManifest {
  if (!manifest?.teams?.length) {
    return createDefaultTeamManifest();
  }
  return {
    version: TEAM_MANIFEST_VERSION,
    actions: normalizeTeamActionContracts(manifest.actions),
    bindings: normalizeGatewayRouteBindings(manifest.bindings),
    teams: normalizeTeams(manifest.teams),
  };
}

export function findTeamManifestTeam(
  manifest: TeamManifest,
  teamId: string | null | undefined,
): ManifestTeam | null {
  const normalized = nonEmpty(teamId);
  if (!normalized) {
    return null;
  }
  return manifest.teams.find((team) => team.id === normalized) ?? null;
}

export function findTeamManifestMember(
  team: ManifestTeam,
  memberId: string | null | undefined,
): ManifestMember | null {
  const normalized = nonEmpty(memberId);
  if (!normalized) {
    return null;
  }
  return team.members?.find((member) => member.id === normalized) ?? null;
}

export function findTeamActionContract(
  actions: readonly TeamActionContract[] | null | undefined,
  actionId: string | null | undefined,
): TeamActionContract | null {
  const normalized = nonEmpty(actionId);
  if (!normalized) {
    return null;
  }
  return actions?.find((action) => action.id === normalized) ?? null;
}

export const TEAM_MANIFEST_VERSION = 1 as const;

export const DEFAULT_TEAM_ID = "default" as const;
export const DEFAULT_TEAM_MEMBER_ID = "default-agent" as const;

export const DEFAULT_TEAM_ROUTE_KEYS = ["kanban", "runs", "config", "workspace"] as const;
export const TEAM_ACTION_INPUT_MODES = ["command", "json", "text"] as const;
export const TEAM_ACTION_OUTPUT_MODES = [
  "artifact",
  "json",
  "markdown",
  "text",
] as const;

export type TeamManifestVersion = typeof TEAM_MANIFEST_VERSION;
export type DefaultTeamRouteKey = (typeof DEFAULT_TEAM_ROUTE_KEYS)[number];
export type TeamActionInputMode = (typeof TEAM_ACTION_INPUT_MODES)[number];
export type TeamActionOutputMode = (typeof TEAM_ACTION_OUTPUT_MODES)[number];
export type TeamActionHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type TeamActionParamType =
  | "boolean"
  | "enum"
  | "file"
  | "json"
  | "number"
  | "string";
export type TeamActionJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly TeamActionJsonValue[]
  | { readonly [key: string]: TeamActionJsonValue };

export type TeamRouteKey =
  | DefaultTeamRouteKey
  | "action"
  | "agent.action"
  | "agent.config"
  | "agent.workspace"
  | (string & {});

export type ManifestIdentity = {
  name?: string | null;
  displayName?: string | null;
  slug?: string | null;
  code?: string | null;
  aliases?: readonly string[] | null;
  /** Host/domain-specific identity hints (e.g. CAVI portalId/sector). Agnostic core never reads these. */
  metadata?: Record<string, unknown> | null;
};

export type TeamWorkspacePathEntry =
  | string
  | {
      key: string;
      path?: string | null;
    };

export type TeamWorkspaceConfig = {
  rootPath: string;
  paths?: readonly TeamWorkspacePathEntry[] | null;
};

export type TeamActionParamContract = {
  key: string;
  type?: TeamActionParamType | null;
  required?: boolean | null;
  default?: TeamActionJsonValue;
  values?: readonly string[] | null;
  aliases?: readonly string[] | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionInputContract = {
  mode?: TeamActionInputMode | null;
  command?: string | null;
  params?: readonly TeamActionParamContract[] | null;
  schema?: Record<string, unknown> | null;
  examples?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionArtifactContract = {
  key: string;
  contentType?: string | null;
  path?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionOutputContract = {
  mode?: TeamActionOutputMode | null;
  contentType?: string | null;
  schema?: Record<string, unknown> | null;
  artifacts?: readonly TeamActionArtifactContract[] | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionRouteContract = {
  method?: TeamActionHttpMethod | null;
  surfaceKey?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionContract = {
  id: string;
  title?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  route?: TeamActionRouteContract | null;
  input?: TeamActionInputContract | null;
  output?: TeamActionOutputContract | null;
  defaults?: Record<string, TeamActionJsonValue> | null;
  capabilities?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionArtifact = {
  key: string;
  contentType?: string | null;
  path?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionResponseBase = {
  actionId?: string | null;
  teamId?: string | null;
  memberId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamActionResponse =
  | (TeamActionResponseBase & {
      kind: "artifact";
      artifacts: readonly TeamActionArtifact[];
      data?: TeamActionJsonValue;
    })
  | (TeamActionResponseBase & {
      kind: "json";
      data: TeamActionJsonValue;
    })
  | (TeamActionResponseBase & {
      kind: "markdown";
      markdown: string;
    })
  | (TeamActionResponseBase & {
      kind: "text";
      text: string;
    });

export type ManifestMember = {
  id: string;
  identity?: ManifestIdentity | null;
  workspace?: TeamWorkspaceConfig | null;
  actions?: readonly TeamActionContract[] | null;
  capabilities?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type ManifestRouteConfig = {
  key: string;
  path?: string | null;
};

export type ManifestTeam = {
  id: string;
  identity?: ManifestIdentity | null;
  members?: readonly ManifestMember[] | null;
  workspace?: TeamWorkspaceConfig | null;
  actions?: readonly TeamActionContract[] | null;
  capabilities?: readonly string[] | null;
  routes?: readonly ManifestRouteConfig[] | null;
  metadata?: Record<string, unknown> | null;
};

export type GatewayRouteBinding = {
  id: string;
  teamId: string;
  memberId?: string | null;
  source?: string | null;
  channel?: string | null;
  actionId?: string | null;
  routeKey?: TeamRouteKey | null;
  sessionKeyPattern?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type GatewayResolvedRouteBinding = {
  id: string;
  teamId: string;
  memberId: string | null;
  source: string | null;
  channel: string | null;
  actionId: string | null;
  routeKey: TeamRouteKey;
  path: string;
  metadata?: Record<string, unknown> | null;
};

export type ResolveGatewayRouteBindingOptions = {
  bindingId?: string | null;
  source?: string | null;
  channel?: string | null;
  sessionKey?: string | null;
  key?: string | null;
  agentId?: string | null;
  actionId?: string | null;
};

export type TeamManifest = {
  version: TeamManifestVersion;
  actions?: readonly TeamActionContract[] | null;
  bindings?: readonly GatewayRouteBinding[] | null;
  teams: readonly ManifestTeam[];
};

export type CreateDefaultTeamManifestOptions = {
  teamId?: string;
  memberId?: string;
  workspaceRootPath?: string | null;
  workspacePaths?: readonly TeamWorkspacePathEntry[] | null;
};

export type ResolveTeamRoutePathOptions = {
  teamId: string;
  actionId?: string | null;
  agentId?: string | null;
  workspacePath?: string | null;
};

export type ResolveTeamWorkspacePathOptions = {
  memberId?: string | null;
};

export type ResolveTeamActionContractOptions = {
  memberId?: string | null;
};

type NormalizedWorkspacePathEntry = {
  key: string;
  path: string;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requiredText(value: string | null | undefined, label: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw new Error(`team manifest: missing ${label}`);
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

function uniqueStrings(values: readonly string[] | null | undefined): string[] {
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

function hasOwn(value: object, key: string): boolean {
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
    throw new Error(`team manifest: invalid action input mode "${mode}"`);
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
    throw new Error(`team manifest: invalid action output mode "${mode}"`);
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
      throw new Error(`team manifest: invalid action param type "${type}"`);
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
      throw new Error(`team manifest: invalid action route method "${method}"`);
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
      throw new Error(`team manifest: duplicate action param "${entry.key}"`);
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
      throw new Error(`team manifest: duplicate action artifact "${entry.key}"`);
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
      throw new Error(`team manifest: duplicate action "${entry.id}"`);
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
    throw new Error(`team manifest: invalid ${label}: ${segment}`);
  }
  return encodeURIComponent(segment);
}

function normalizeRelativePath(value: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw new Error("team manifest: missing workspace path");
  }
  if (
    /^[a-z][a-z0-9+.-]*:/iu.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.includes("\\")
  ) {
    throw new Error(`team manifest: workspace path must be relative: ${trimmed}`);
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
    throw new Error(`team manifest: invalid workspace path: ${trimmed}`);
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
    throw new Error(`team manifest: invalid ${label}: ${trimmed}`);
  }
  const segments = trimmed
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`team manifest: invalid ${label}: ${trimmed}`);
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
      throw new Error(`team manifest: invalid ${label}: ${trimmed}`);
    }
  }
  return `/${segments.join("/")}`;
}

function normalizeRootPath(value: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw new Error("team manifest: missing workspace rootPath");
  }
  return normalizeAbsoluteApiPath(trimmed, "workspace rootPath");
}

function joinUrlPath(segments: readonly string[]): string {
  return `/${segments.map((segment) => pathSegment(segment, "path segment")).join("/")}`;
}

function workspacePathSegments(value: string | null | undefined): string[] {
  return normalizeRelativePath(requiredText(value, "workspace path")).split("/");
}

function joinWorkspacePath(rootPath: string, relativePath: string): string {
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
    throw new Error("team manifest: missing workspace path key");
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
      throw new Error(`team manifest: duplicate member "${entry.id}"`);
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
      throw new Error(`team manifest: duplicate route "${key}"`);
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
      throw new Error(`team manifest: duplicate team "${entry.id}"`);
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

function normalizeGatewayRouteBindings(
  bindings: readonly GatewayRouteBinding[] | null | undefined,
): GatewayRouteBinding[] {
  const seen = new Set<string>();
  const normalized: GatewayRouteBinding[] = [];
  for (const binding of bindings ?? []) {
    const entry = normalizeGatewayRouteBinding(binding);
    if (seen.has(entry.id)) {
      throw new Error(`team manifest: duplicate gateway route binding "${entry.id}"`);
    }
    seen.add(entry.id);
    normalized.push(entry);
  }
  return normalized;
}

function findWorkspacePath(
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

function mergeRecords<T>(
  base: Record<string, T> | null | undefined,
  override: Record<string, T> | null | undefined,
): Record<string, T> | null {
  const merged: Record<string, T> = {};
  Object.assign(merged, base ?? {}, override ?? {});
  return Object.keys(merged).length ? merged : null;
}

function mergeActionParamContract(
  base: TeamActionParamContract,
  override: TeamActionParamContract,
): TeamActionParamContract {
  const metadata = mergeRecords(base.metadata, override.metadata);
  const required =
    override.required !== undefined && override.required !== null
      ? override.required
      : base.required;
  return {
    key: base.key,
    ...(override.type ?? base.type ? { type: override.type ?? base.type } : {}),
    ...(required !== undefined && required !== null
      ? { required }
      : {}),
    ...(hasOwn(override, "default")
      ? { default: override.default }
      : hasOwn(base, "default")
        ? { default: base.default }
        : {}),
    values: uniqueStrings([...(base.values ?? []), ...(override.values ?? [])]),
    aliases: uniqueStrings([...(base.aliases ?? []), ...(override.aliases ?? [])]),
    ...(override.description ?? base.description
      ? { description: override.description ?? base.description }
      : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function mergeActionParams(
  base: readonly TeamActionParamContract[] | null | undefined,
  override: readonly TeamActionParamContract[] | null | undefined,
): TeamActionParamContract[] {
  const merged = new Map<string, TeamActionParamContract>();
  for (const param of base ?? []) {
    merged.set(param.key, param);
  }
  for (const param of override ?? []) {
    const existing = merged.get(param.key);
    merged.set(param.key, existing ? mergeActionParamContract(existing, param) : param);
  }
  return [...merged.values()];
}

function mergeActionInputContract(
  base: TeamActionInputContract | null | undefined,
  override: TeamActionInputContract | null | undefined,
): TeamActionInputContract | null {
  if (!base && !override) {
    return null;
  }
  const metadata = mergeRecords(base?.metadata, override?.metadata);
  return {
    ...(override?.mode ?? base?.mode ? { mode: override?.mode ?? base?.mode } : {}),
    ...(override?.command ?? base?.command
      ? { command: override?.command ?? base?.command }
      : {}),
    params: mergeActionParams(base?.params, override?.params),
    ...(override?.schema ?? base?.schema ? { schema: override?.schema ?? base?.schema } : {}),
    examples: uniqueStrings([...(base?.examples ?? []), ...(override?.examples ?? [])]),
    ...(metadata ? { metadata } : {}),
  };
}

function mergeActionArtifactContract(
  base: TeamActionArtifactContract,
  override: TeamActionArtifactContract,
): TeamActionArtifactContract {
  const metadata = mergeRecords(base.metadata, override.metadata);
  return {
    key: base.key,
    ...(override.contentType ?? base.contentType
      ? { contentType: override.contentType ?? base.contentType }
      : {}),
    ...(override.path ?? base.path ? { path: override.path ?? base.path } : {}),
    ...(override.description ?? base.description
      ? { description: override.description ?? base.description }
      : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function mergeActionArtifacts(
  base: readonly TeamActionArtifactContract[] | null | undefined,
  override: readonly TeamActionArtifactContract[] | null | undefined,
): TeamActionArtifactContract[] {
  const merged = new Map<string, TeamActionArtifactContract>();
  for (const artifact of base ?? []) {
    merged.set(artifact.key, artifact);
  }
  for (const artifact of override ?? []) {
    const existing = merged.get(artifact.key);
    merged.set(
      artifact.key,
      existing ? mergeActionArtifactContract(existing, artifact) : artifact,
    );
  }
  return [...merged.values()];
}

function mergeActionOutputContract(
  base: TeamActionOutputContract | null | undefined,
  override: TeamActionOutputContract | null | undefined,
): TeamActionOutputContract | null {
  if (!base && !override) {
    return null;
  }
  const metadata = mergeRecords(base?.metadata, override?.metadata);
  return {
    ...(override?.mode ?? base?.mode ? { mode: override?.mode ?? base?.mode } : {}),
    ...(override?.contentType ?? base?.contentType
      ? { contentType: override?.contentType ?? base?.contentType }
      : {}),
    ...(override?.schema ?? base?.schema ? { schema: override?.schema ?? base?.schema } : {}),
    artifacts: mergeActionArtifacts(base?.artifacts, override?.artifacts),
    ...(metadata ? { metadata } : {}),
  };
}

function mergeActionRouteContract(
  base: TeamActionRouteContract | null | undefined,
  override: TeamActionRouteContract | null | undefined,
): TeamActionRouteContract | null {
  if (!base && !override) {
    return null;
  }
  const metadata = mergeRecords(base?.metadata, override?.metadata);
  return {
    ...(override?.method ?? base?.method
      ? { method: override?.method ?? base?.method }
      : {}),
    ...(override?.surfaceKey ?? base?.surfaceKey
      ? { surfaceKey: override?.surfaceKey ?? base?.surfaceKey }
      : {}),
    ...(override?.path ?? base?.path ? { path: override?.path ?? base?.path } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function mergeTeamActionContracts(
  base: TeamActionContract,
  override: TeamActionContract,
): TeamActionContract {
  if (base.id !== override.id) {
    throw new Error(
      `team manifest: cannot merge action "${override.id}" into "${base.id}"`,
    );
  }
  const route = mergeActionRouteContract(base.route, override.route);
  const input = mergeActionInputContract(base.input, override.input);
  const output = mergeActionOutputContract(base.output, override.output);
  const defaults = mergeRecords(base.defaults, override.defaults);
  const metadata = mergeRecords(base.metadata, override.metadata);
  const enabled =
    override.enabled !== undefined && override.enabled !== null
      ? override.enabled
      : base.enabled;
  return {
    id: base.id,
    ...(override.title ?? base.title ? { title: override.title ?? base.title } : {}),
    ...(override.description ?? base.description
      ? { description: override.description ?? base.description }
      : {}),
    ...(enabled !== undefined && enabled !== null ? { enabled } : {}),
    ...(route ? { route } : {}),
    ...(input ? { input } : {}),
    ...(output ? { output } : {}),
    ...(defaults ? { defaults } : {}),
    capabilities: uniqueStrings([
      ...(base.capabilities ?? []),
      ...(override.capabilities ?? []),
    ]),
    ...(metadata ? { metadata } : {}),
  };
}

export function resolveTeamActionContract(
  manifest: TeamManifest,
  teamId: string | null | undefined,
  actionId: string | null | undefined,
  options: ResolveTeamActionContractOptions = {},
): TeamActionContract {
  const normalizedTeamId = requiredText(teamId, "team id");
  const normalizedActionId = requiredText(actionId, "action id");
  const team = findTeamManifestTeam(manifest, normalizedTeamId);
  if (!team) {
    throw new Error(`team manifest: unknown team "${normalizedTeamId}"`);
  }
  const normalizedMemberId = nonEmpty(options.memberId);
  const member = normalizedMemberId
    ? findTeamManifestMember(team, normalizedMemberId)
    : null;
  if (normalizedMemberId && !member) {
    throw new Error(
      `team manifest: unknown member "${normalizedMemberId}" for team "${team.id}"`,
    );
  }
  const scopedActions = [
    findTeamActionContract(manifest.actions, normalizedActionId),
    findTeamActionContract(team.actions, normalizedActionId),
    member ? findTeamActionContract(member.actions, normalizedActionId) : null,
  ].filter((action): action is TeamActionContract => Boolean(action));
  if (!scopedActions.length) {
    throw new Error(
      `team manifest: unknown action "${normalizedActionId}" for team "${team.id}"`,
    );
  }
  return scopedActions.reduce((merged, action) =>
    mergeTeamActionContracts(merged, action),
  );
}

export function resolveTeamActionApiPath(
  manifest: TeamManifest,
  teamId: string | null | undefined,
  actionId: string | null | undefined,
  options: ResolveTeamActionContractOptions = {},
): string {
  const action = resolveTeamActionContract(manifest, teamId, actionId, options);
  if (action.enabled === false) {
    throw new Error(`team manifest: action "${action.id}" is disabled`);
  }
  if (action.route?.path) {
    return action.route.path;
  }
  const normalizedMemberId = nonEmpty(options.memberId);
  if (normalizedMemberId) {
    return resolveTeamRoutePath("agent.action", {
      teamId: requiredText(teamId, "team id"),
      agentId: normalizedMemberId,
      actionId: action.id,
    });
  }
  return resolveTeamRoutePath("action", {
    teamId: requiredText(teamId, "team id"),
    actionId: action.id,
  });
}

export function resolveTeamRoutePath(
  routeKey: TeamRouteKey,
  options: ResolveTeamRoutePathOptions,
): string {
  const teamId = requiredText(options.teamId, "team id");
  switch (routeKey) {
    case "action": {
      const actionId = requiredText(options.actionId, "action id");
      return joinUrlPath(["api", "teams", teamId, "actions", actionId]);
    }
    case "agent.action": {
      const agentId = requiredText(options.agentId, "agent id");
      const actionId = requiredText(options.actionId, "action id");
      return joinUrlPath([
        "api",
        "teams",
        teamId,
        "agents",
        agentId,
        "actions",
        actionId,
      ]);
    }
    case "kanban":
    case "runs":
    case "config":
      return joinUrlPath(["api", "teams", teamId, routeKey]);
    case "workspace":
      return joinUrlPath([
        "api",
        "teams",
        teamId,
        "workspace",
        ...workspacePathSegments(options.workspacePath),
      ]);
    case "agent.config": {
      const agentId = requiredText(options.agentId, "agent id");
      return joinUrlPath([
        "api",
        "teams",
        teamId,
        "agents",
        agentId,
        "config",
      ]);
    }
    case "agent.workspace": {
      const agentId = requiredText(options.agentId, "agent id");
      return joinUrlPath([
        "api",
        "teams",
        teamId,
        "agents",
        agentId,
        "workspace",
        ...workspacePathSegments(options.workspacePath),
      ]);
    }
    default:
      throw new Error(`team manifest: unknown team route "${routeKey}"`);
  }
}

function normalizeBindingMatchValue(value: string | null | undefined): string | null {
  const trimmed = nonEmpty(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function expandSessionKeyPattern(
  pattern: string,
  binding: GatewayRouteBinding,
): string {
  return pattern
    .replace(/\{teamId\}/gu, binding.teamId)
    .replace(/\{memberId\}/gu, binding.memberId ?? "")
    .replace(/\{actionId\}/gu, binding.actionId ?? "");
}

function matchesSessionKeyPattern(
  binding: GatewayRouteBinding,
  sessionKey: string | null,
): boolean {
  const pattern = nonEmpty(binding.sessionKeyPattern);
  if (!pattern) {
    return true;
  }
  const candidate = nonEmpty(sessionKey);
  if (!candidate) {
    return false;
  }
  const expanded = expandSessionKeyPattern(pattern, binding);
  if (!expanded.includes("*")) {
    return candidate === expanded;
  }
  const source = expanded.split("*").map(escapeRegExp).join(".*");
  return new RegExp(`^${source}$`, "u").test(candidate);
}

function bindingMatchScore(
  binding: GatewayRouteBinding,
  options: ResolveGatewayRouteBindingOptions,
): number {
  if (options.bindingId && binding.id !== options.bindingId.trim()) {
    return -1;
  }

  const inputSource = normalizeBindingMatchValue(options.source);
  const inputChannel = normalizeBindingMatchValue(options.channel);
  const inputAgentId = normalizeBindingMatchValue(options.agentId);
  const inputActionId = normalizeBindingMatchValue(options.actionId);
  const bindingSource = normalizeBindingMatchValue(binding.source);
  const bindingChannel = normalizeBindingMatchValue(binding.channel);
  const bindingMemberId = normalizeBindingMatchValue(binding.memberId);
  const bindingActionId = normalizeBindingMatchValue(binding.actionId);

  if (bindingSource && bindingSource !== inputSource && bindingSource !== inputChannel) {
    return -1;
  }
  if (bindingChannel && bindingChannel !== inputChannel && bindingChannel !== inputSource) {
    return -1;
  }
  if (bindingMemberId && inputAgentId && bindingMemberId !== inputAgentId) {
    return -1;
  }
  if (bindingActionId && inputActionId && bindingActionId !== inputActionId) {
    return -1;
  }
  const sessionKey = nonEmpty(options.sessionKey) ?? nonEmpty(options.key);
  if (!matchesSessionKeyPattern(binding, sessionKey)) {
    return -1;
  }

  let score = 0;
  if (options.bindingId) score += 100;
  if (binding.sessionKeyPattern) score += 20;
  if (bindingSource) score += 10;
  if (bindingChannel) score += 10;
  if (bindingMemberId) score += 5;
  if (bindingActionId) score += 5;
  return score;
}

function bindingRouteKey(binding: GatewayRouteBinding): TeamRouteKey {
  const explicit = nonEmpty(binding.routeKey);
  if (explicit) {
    return explicit as TeamRouteKey;
  }
  if (nonEmpty(binding.actionId)) {
    return nonEmpty(binding.memberId) ? "agent.action" : "action";
  }
  return "runs";
}

export function resolveGatewayRouteBinding(
  manifest: TeamManifest,
  options: ResolveGatewayRouteBindingOptions,
): GatewayResolvedRouteBinding | null {
  const bindings = normalizeGatewayRouteBindings(manifest.bindings);
  let selected: GatewayRouteBinding | null = null;
  let selectedScore = -1;
  for (const binding of bindings) {
    const score = bindingMatchScore(binding, options);
    if (score > selectedScore) {
      selected = binding;
      selectedScore = score;
    }
  }
  if (!selected || selectedScore < 0) {
    return null;
  }

  const team = findTeamManifestTeam(manifest, selected.teamId);
  if (!team) {
    throw new Error(`team manifest: binding "${selected.id}" references unknown team "${selected.teamId}"`);
  }
  const memberId = nonEmpty(selected.memberId);
  if (memberId && !findTeamManifestMember(team, memberId)) {
    throw new Error(
      `team manifest: binding "${selected.id}" references unknown member "${memberId}" for team "${team.id}"`,
    );
  }

  const routeKey = bindingRouteKey(selected);
  const actionId = nonEmpty(selected.actionId);
  const path = resolveTeamRoutePath(routeKey, {
    teamId: team.id,
    agentId: memberId,
    actionId,
  });
  return {
    id: selected.id,
    teamId: team.id,
    memberId,
    source: nonEmpty(selected.source),
    channel: nonEmpty(selected.channel),
    actionId,
    routeKey,
    path,
    ...(selected.metadata ? { metadata: selected.metadata } : {}),
  };
}

function resolveTeamWorkspaceEntry(
  team: ManifestTeam,
  keyOrPath: string,
  options: ResolveTeamWorkspacePathOptions = {},
): NormalizedWorkspacePathEntry {
  const member = findTeamManifestMember(team, options.memberId);
  const workspace = member?.workspace ?? team.workspace ?? null;
  if (!workspace) {
    throw new Error(`team manifest: team "${team.id}" has no workspace root`);
  }
  const entry = findWorkspacePath(workspace, keyOrPath);
  if (!entry) {
    throw new Error(
      `team manifest: workspace path "${keyOrPath}" is not whitelisted for team "${team.id}"`,
    );
  }
  return entry;
}

export function resolveTeamWorkspacePath(
  team: ManifestTeam,
  keyOrPath: string,
  options: ResolveTeamWorkspacePathOptions = {},
): string {
  const member = findTeamManifestMember(team, options.memberId);
  const workspace = member?.workspace ?? team.workspace ?? null;
  if (!workspace) {
    throw new Error(`team manifest: team "${team.id}" has no workspace root`);
  }
  const entry = resolveTeamWorkspaceEntry(team, keyOrPath, options);
  return joinWorkspacePath(workspace.rootPath, entry.path);
}

export function resolveTeamWorkspaceApiPath(
  team: ManifestTeam,
  keyOrPath: string,
  options: ResolveTeamWorkspacePathOptions = {},
): string {
  const entry = resolveTeamWorkspaceEntry(team, keyOrPath, options);
  if (options.memberId) {
    return resolveTeamRoutePath("agent.workspace", {
      teamId: team.id,
      agentId: options.memberId,
      workspacePath: entry.path,
    });
  }
  return resolveTeamRoutePath("workspace", {
    teamId: team.id,
    workspacePath: entry.path,
  });
}

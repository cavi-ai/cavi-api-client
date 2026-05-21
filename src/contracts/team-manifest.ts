export const TEAM_MANIFEST_VERSION = 1 as const;

export const DEFAULT_TEAM_ID = "default" as const;
export const DEFAULT_TEAM_MEMBER_ID = "default-agent" as const;

export const DEFAULT_TEAM_ROUTE_KEYS = ["kanban", "runs", "config", "workspace"] as const;

export type TeamManifestVersion = typeof TEAM_MANIFEST_VERSION;
export type DefaultTeamRouteKey = (typeof DEFAULT_TEAM_ROUTE_KEYS)[number];
export type TeamRouteKey =
  | DefaultTeamRouteKey
  | "agent.config"
  | "agent.workspace"
  | (string & {});

export type TeamManifestIdentity = {
  name?: string | null;
  displayName?: string | null;
  slug?: string | null;
  code?: string | null;
  sectorSlug?: string | null;
  sectorCode?: string | null;
  portalId?: string | null;
  aliases?: readonly string[] | null;
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

export type TeamManifestMember = {
  id: string;
  identity?: TeamManifestIdentity | null;
  workspace?: TeamWorkspaceConfig | null;
  capabilities?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamManifestRouteConfig = {
  key: string;
  path?: string | null;
};

export type TeamManifestTeam = {
  id: string;
  identity?: TeamManifestIdentity | null;
  members?: readonly TeamManifestMember[] | null;
  workspace?: TeamWorkspaceConfig | null;
  capabilities?: readonly string[] | null;
  routes?: readonly TeamManifestRouteConfig[] | null;
  metadata?: Record<string, unknown> | null;
};

export type TeamManifest = {
  version: TeamManifestVersion;
  teams: readonly TeamManifestTeam[];
};

export type CreateDefaultTeamManifestOptions = {
  teamId?: string;
  memberId?: string;
  workspaceRootPath?: string | null;
  workspacePaths?: readonly TeamWorkspacePathEntry[] | null;
};

export type ResolveTeamRoutePathOptions = {
  teamId: string;
  agentId?: string | null;
  workspacePath?: string | null;
};

export type ResolveTeamWorkspacePathOptions = {
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

function pathSegment(value: string, label: string): string {
  return encodeURIComponent(requiredText(value, label));
}

function normalizeRelativePath(value: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw new Error("team manifest: missing workspace path");
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed) || trimmed.startsWith("/")) {
    throw new Error(`team manifest: workspace path must be relative: ${trimmed}`);
  }
  const segments = trimmed
    .replace(/\\/gu, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(`team manifest: invalid workspace path: ${trimmed}`);
  }
  return segments.join("/");
}

function normalizeRootPath(value: string): string {
  const trimmed = nonEmpty(value);
  if (!trimmed) {
    throw new Error("team manifest: missing workspace rootPath");
  }
  return trimmed.replace(/\/+$/u, "");
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
  identity: TeamManifestIdentity | null | undefined,
): TeamManifestIdentity | null {
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
    ...(nonEmpty(identity.sectorSlug)
      ? { sectorSlug: nonEmpty(identity.sectorSlug) }
      : {}),
    ...(nonEmpty(identity.sectorCode)
      ? { sectorCode: nonEmpty(identity.sectorCode) }
      : {}),
    ...(nonEmpty(identity.portalId) ? { portalId: nonEmpty(identity.portalId) } : {}),
    aliases: uniqueStrings(identity.aliases),
  };
}

function normalizeMember(member: TeamManifestMember): TeamManifestMember {
  return {
    id: requiredText(member.id, "member id"),
    ...(member.identity ? { identity: normalizeIdentity(member.identity) } : {}),
    ...(member.workspace
      ? { workspace: normalizeWorkspaceConfig(member.workspace) }
      : {}),
    capabilities: uniqueStrings(member.capabilities),
    ...(member.metadata ? { metadata: member.metadata } : {}),
  };
}

function normalizeTeam(team: TeamManifestTeam): TeamManifestTeam {
  return {
    id: requiredText(team.id, "team id"),
    ...(team.identity ? { identity: normalizeIdentity(team.identity) } : {}),
    members: (team.members ?? []).map(normalizeMember),
    ...(team.workspace ? { workspace: normalizeWorkspaceConfig(team.workspace) } : {}),
    capabilities: uniqueStrings(team.capabilities),
    routes: (team.routes ?? []).map((route) => ({
      key: requiredText(route.key, "route key"),
      ...(nonEmpty(route.path) ? { path: nonEmpty(route.path) } : {}),
    })),
    ...(team.metadata ? { metadata: team.metadata } : {}),
  };
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
    teams: manifest.teams.map(normalizeTeam),
  };
}

export function findTeamManifestTeam(
  manifest: TeamManifest,
  teamId: string | null | undefined,
): TeamManifestTeam | null {
  const normalized = nonEmpty(teamId);
  if (!normalized) {
    return null;
  }
  return manifest.teams.find((team) => team.id === normalized) ?? null;
}

export function findTeamManifestMember(
  team: TeamManifestTeam,
  memberId: string | null | undefined,
): TeamManifestMember | null {
  const normalized = nonEmpty(memberId);
  if (!normalized) {
    return null;
  }
  return team.members?.find((member) => member.id === normalized) ?? null;
}

export function resolveTeamRoutePath(
  routeKey: TeamRouteKey,
  options: ResolveTeamRoutePathOptions,
): string {
  const teamId = requiredText(options.teamId, "team id");
  switch (routeKey) {
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

function resolveTeamWorkspaceEntry(
  team: TeamManifestTeam,
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
  team: TeamManifestTeam,
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
  team: TeamManifestTeam,
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

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
  /** Values substituted into `{token}` placeholders in the action's route path. */
  params?: Record<string, string | number | boolean> | null;
  /** Query parameters appended to the resolved path (via `appendHttpQuery`). */
  query?: Record<string, string | number | boolean | undefined> | null;
};

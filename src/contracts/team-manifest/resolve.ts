import { invalidConfigError } from "../../core/error-factories.js";
import { appendHttpQuery } from "../paths.js";
import type {
  TeamRouteKey,
  TeamActionParamContract,
  TeamActionInputContract,
  TeamActionArtifactContract,
  TeamActionOutputContract,
  TeamActionRouteContract,
  TeamActionContract,
  ManifestTeam,
  GatewayRouteBinding,
  GatewayResolvedRouteBinding,
  ResolveGatewayRouteBindingOptions,
  TeamManifest,
  ResolveTeamRoutePathOptions,
  ResolveTeamWorkspacePathOptions,
  ResolveTeamActionContractOptions,
} from "./types.js";
import {
  nonEmpty,
  requiredText,
  uniqueStrings,
  hasOwn,
  joinUrlPath,
  workspacePathSegments,
  joinWorkspacePath,
  normalizeGatewayRouteBindings,
  findWorkspacePath,
  findTeamManifestTeam,
  findTeamManifestMember,
  findTeamActionContract,
} from "./normalize.js";
import type {
  NormalizedWorkspacePathEntry,
} from "./normalize.js";

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
    throw invalidConfigError(
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
    throw invalidConfigError(`team manifest: unknown team "${normalizedTeamId}"`);
  }
  const normalizedMemberId = nonEmpty(options.memberId);
  const member = normalizedMemberId
    ? findTeamManifestMember(team, normalizedMemberId)
    : null;
  if (normalizedMemberId && !member) {
    throw invalidConfigError(
      `team manifest: unknown member "${normalizedMemberId}" for team "${team.id}"`,
    );
  }
  const scopedActions = [
    findTeamActionContract(manifest.actions, normalizedActionId),
    findTeamActionContract(team.actions, normalizedActionId),
    member ? findTeamActionContract(member.actions, normalizedActionId) : null,
  ].filter((action): action is TeamActionContract => Boolean(action));
  if (!scopedActions.length) {
    throw invalidConfigError(
      `team manifest: unknown action "${normalizedActionId}" for team "${team.id}"`,
    );
  }
  return scopedActions.reduce((merged, action) =>
    mergeTeamActionContracts(merged, action),
  );
}

function substituteRouteParams(
  path: string,
  params: Record<string, string | number | boolean> | null | undefined,
): string {
  return path.replace(/\{([A-Za-z0-9_]+)\}/gu, (_match, token: string) => {
    const value = params?.[token];
    if (value === undefined || value === null || value === "") {
      throw invalidConfigError(`team manifest: missing route param "${token}"`);
    }
    return encodeURIComponent(String(value));
  });
}

export function resolveTeamActionApiPath(
  manifest: TeamManifest,
  teamId: string | null | undefined,
  actionId: string | null | undefined,
  options: ResolveTeamActionContractOptions = {},
): string {
  const action = resolveTeamActionContract(manifest, teamId, actionId, options);
  if (action.enabled === false) {
    throw invalidConfigError(`team manifest: action "${action.id}" is disabled`);
  }
  if (action.route?.path) {
    const withParams = substituteRouteParams(action.route.path, options.params);
    return options.query ? appendHttpQuery(withParams, options.query) : withParams;
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
      throw invalidConfigError(`team manifest: unknown team route "${routeKey}"`);
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
    throw invalidConfigError(`team manifest: binding "${selected.id}" references unknown team "${selected.teamId}"`);
  }
  const memberId = nonEmpty(selected.memberId);
  if (memberId && !findTeamManifestMember(team, memberId)) {
    throw invalidConfigError(
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
    throw invalidConfigError(`team manifest: team "${team.id}" has no workspace root`);
  }
  const entry = findWorkspacePath(workspace, keyOrPath);
  if (!entry) {
    throw invalidConfigError(
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
    throw invalidConfigError(`team manifest: team "${team.id}" has no workspace root`);
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

export function appendHttpQuery(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

/**
 * Validate and normalize a caller-supplied **relative** path, returning the
 * cleaned `a/b/c` form or throwing on anything unsafe.
 *
 * This is the **opt-in** companion to the manifest workspace whitelist
 * (`resolveTeamWorkspacePath`). The whitelist is the primary, recommended guard:
 * a path the consumer never declared can never be resolved. Reach for this only
 * when a downstream surface must accept a *free-form* relative path — e.g. a raw
 * `?path=` value a consumer wants to hand to a workspace/wiki file endpoint
 * (`GATEWAY_WIKI_API_ENDPOINTS.read`, a manifest action `query`).
 *
 * `appendHttpQuery` does **not** sanitize values — it only URL-encodes them, so
 * `?path=../secret` becomes `?path=..%2Fsecret` and the backend decodes it back.
 * Run untrusted path values through this first, then pass the result as a query
 * value via `appendHttpQuery` (which encodes it).
 *
 * Rejects: empty/whitespace, absolute (`/…`), protocol-relative (`//…`), URL
 * schemes (`file:`, `http:`…), backslashes, and any `.`/`..` segment — including
 * percent-encoded forms such as `%2e%2e`. Interior `./` and duplicate slashes
 * are collapsed. The return value is **not** URL-encoded.
 *
 * This intentionally mirrors the relative-path rules the team manifest enforces
 * internally for workspace whitelist entries (`src/contracts/team-manifest.ts`).
 * Both are guarded by `safe-relative-path.test.ts`; keep them in lockstep.
 */
export function assertSafeRelativePath(value: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error("assertSafeRelativePath: path must not be empty");
  }
  if (
    /^[a-z][a-z0-9+.-]*:/iu.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.includes("\\")
  ) {
    throw new Error(`assertSafeRelativePath: path must be relative: ${trimmed}`);
  }
  const segments = trimmed
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`assertSafeRelativePath: invalid path: ${trimmed}`);
  }
  for (const segment of segments) {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // Malformed encoding stays raw and is caught by the segment checks below.
    }
    if (
      segment === "." ||
      segment === ".." ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      throw new Error(`assertSafeRelativePath: path must not traverse: ${trimmed}`);
    }
  }
  return segments.join("/");
}

export const HERMES_API_ENDPOINT_TEMPLATES = {
  ecgSharedFiles: "/api/v1/files?agent={agent}&folder={folder}",
  runApproval: "/v1/runs/{run_id}/approval",
} as const;

export const HERMES_API_ENDPOINTS = {
  health: "/health",
  healthDetailed: "/health/detailed",
  models: "/v1/models",
  capabilities: "/v1/capabilities",
  chatCompletions: "/v1/chat/completions",
  responses: "/v1/responses",
  response: (responseId: string) => `/v1/responses/${encodeURIComponent(responseId)}`,
  runs: "/v1/runs",
  run: (runId: string) => `/v1/runs/${encodeURIComponent(runId)}`,
  runEvents: (runId: string) => `/v1/runs/${encodeURIComponent(runId)}/events`,
  runApproval: (runId: string) => `/v1/runs/${encodeURIComponent(runId)}/approval`,
  runStop: (runId: string) => `/v1/runs/${encodeURIComponent(runId)}/stop`,
  jobs: "/api/jobs",
  job: (jobId: string) => `/api/jobs/${encodeURIComponent(jobId)}`,
} as const;

export const GATEWAY_API_ENDPOINT_TEMPLATES = HERMES_API_ENDPOINT_TEMPLATES;
export const GATEWAY_API_ENDPOINTS = HERMES_API_ENDPOINTS;

export const GATEWAY_SYSTEM_RPC_METHODS = {
  healthSnapshot: "health.snapshot",
  health: "health",
  logsTail: "logs.tail",
} as const;

// OpenClaw RPC method tables and capability baseline live with the provider
// (single source of truth = `OPENCLAW_MANIFEST` in
// src/providers/openclaw/manifest.ts). The public names
// `OPENCLAW_RPC_METHODS`, `OPENCLAW_CORE_RPC_METHODS`, and
// `OPENCLAW_DEFAULT_CAPABILITIES` are re-exported from
// `providers/openclaw/manifest.derive.ts` so consumers see the same identifiers.

// Kanban plugin REST surface. The plugin mounts its router at
// `/api/plugins/kanban/` on the harness dashboard and writes through the same
// code paths as the CLI and the gateway `/kanban` command, so the three
// surfaces share one backing store. Requests carry the dashboard session
// bearer token like any other `/api/plugins/...` route.
export const KANBAN_PLUGIN_API_BASE_PATH = "/api/plugins/kanban" as const;

export const KANBAN_PLUGIN_API_ENDPOINTS = {
  /** Full board grouped into status columns. */
  board: `${KANBAN_PLUGIN_API_BASE_PATH}/board`,
  boards: `${KANBAN_PLUGIN_API_BASE_PATH}/boards`,
  board_: (slug: string) =>
    `${KANBAN_PLUGIN_API_BASE_PATH}/boards/${encodeURIComponent(slug)}`,
  boardSwitch: (slug: string) =>
    `${KANBAN_PLUGIN_API_BASE_PATH}/boards/${encodeURIComponent(slug)}/switch`,
  tasks: `${KANBAN_PLUGIN_API_BASE_PATH}/tasks`,
  task: (taskId: string) =>
    `${KANBAN_PLUGIN_API_BASE_PATH}/tasks/${encodeURIComponent(taskId)}`,
  tasksBulk: `${KANBAN_PLUGIN_API_BASE_PATH}/tasks/bulk`,
  taskComments: (taskId: string) =>
    `${KANBAN_PLUGIN_API_BASE_PATH}/tasks/${encodeURIComponent(taskId)}/comments`,
  taskLog: (taskId: string) =>
    `${KANBAN_PLUGIN_API_BASE_PATH}/tasks/${encodeURIComponent(taskId)}/log`,
  taskReclaim: (taskId: string) =>
    `${KANBAN_PLUGIN_API_BASE_PATH}/tasks/${encodeURIComponent(taskId)}/reclaim`,
  taskReassign: (taskId: string) =>
    `${KANBAN_PLUGIN_API_BASE_PATH}/tasks/${encodeURIComponent(taskId)}/reassign`,
  links: `${KANBAN_PLUGIN_API_BASE_PATH}/links`,
  stats: `${KANBAN_PLUGIN_API_BASE_PATH}/stats`,
  assignees: `${KANBAN_PLUGIN_API_BASE_PATH}/assignees`,
  diagnostics: `${KANBAN_PLUGIN_API_BASE_PATH}/diagnostics`,
  config: `${KANBAN_PLUGIN_API_BASE_PATH}/config`,
  dispatch: `${KANBAN_PLUGIN_API_BASE_PATH}/dispatch`,
  events: `${KANBAN_PLUGIN_API_BASE_PATH}/events`,
} as const;

/**
 * Board columns the plugin renders, left to right. `archived` is a real status
 * but is filter-gated rather than a visible column, so it is not listed here.
 */
export const KANBAN_PLUGIN_BOARD_COLUMNS = [
  "triage",
  "todo",
  "ready",
  "running",
  "blocked",
  "done",
] as const;

/** Status the plugin uses to retire a card; it has no hard-delete route. */
export const KANBAN_PLUGIN_ARCHIVED_STATUS = "archived" as const;

export const GATEWAY_MEDIA_API_BASE_PATH = "/v1/media" as const;

export const GATEWAY_MEDIA_API_ENDPOINTS = {
  root: GATEWAY_MEDIA_API_BASE_PATH,
  providers: (kind?: string | null) =>
    kind
      ? `${GATEWAY_MEDIA_API_BASE_PATH}/${encodeURIComponent(kind)}/providers`
      : `${GATEWAY_MEDIA_API_BASE_PATH}/providers`,
  generate: (kind: string) =>
    `${GATEWAY_MEDIA_API_BASE_PATH}/${encodeURIComponent(kind)}/generate`,
  job: (kind: string, jobId: string) =>
    `${GATEWAY_MEDIA_API_BASE_PATH}/${encodeURIComponent(kind)}/jobs/${encodeURIComponent(jobId)}`,
  assets: (query?: {
    kind?: string | null;
    cursor?: string | null;
    limit?: number | null;
  } | null) =>
    appendHttpQuery(`${GATEWAY_MEDIA_API_BASE_PATH}/assets`, {
      kind: query?.kind ?? undefined,
      cursor: query?.cursor ?? undefined,
      limit: query?.limit ?? undefined,
    }),
  asset: (assetId: string) =>
    `${GATEWAY_MEDIA_API_BASE_PATH}/assets/${encodeURIComponent(assetId)}`,
} as const;

export const HERMES_MEDIA_API_ENDPOINTS = GATEWAY_MEDIA_API_ENDPOINTS;
// NOTE: OpenClaw does not serve `/v1/media/*` — its `/v1/*` surface is OpenAI
// compatibility only (`/v1/chat/completions`, `/v1/responses`, `/v1/models`,
// `/v1/embeddings`). See OPENCLAW_MANIFEST.rest for the authoritative list.

export const GATEWAY_WIKI_API_BASE_PATH = "/v1/wiki" as const;

export const GATEWAY_WIKI_API_ENDPOINTS = {
  root: GATEWAY_WIKI_API_BASE_PATH,
  vaults: `${GATEWAY_WIKI_API_BASE_PATH}/vaults`,
  vault: (vaultId: string) =>
    `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}`,
  tree: (vaultId: string) =>
    `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}/tree`,
  read: (vaultId: string, path: string) =>
    appendHttpQuery(
      `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}/read`,
      { path },
    ),
  ingest: (vaultId: string) =>
    `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}/ingest`,
  compile: (vaultId: string) =>
    `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}/compile`,
  promote: (vaultId: string) =>
    `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}/promote`,
  job: (vaultId: string, jobId: string) =>
    `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}/jobs/${encodeURIComponent(jobId)}`,
  artifact: (vaultId: string, artifactId: string) =>
    `${GATEWAY_WIKI_API_BASE_PATH}/vaults/${encodeURIComponent(vaultId)}/artifacts/${encodeURIComponent(artifactId)}`,
} as const;

export const HERMES_WIKI_API_ENDPOINTS = GATEWAY_WIKI_API_ENDPOINTS;
// NOTE: OpenClaw does not serve `/v1/wiki/*` — wiki on OpenClaw is a plugin
// surface (RPC, not REST). See OPENCLAW_MANIFEST.rest for OpenClaw's actual
// HTTP families.

export const GATEWAY_SESSION_API_PATHS = {
  list: "/api/sessions/list",
  usage: "/api/sessions/usage",
  preview: "/api/sessions/preview",
  detail: "/api/sessions/detail",
  patch: "/api/sessions/patch",
} as const;

export const GATEWAY_AGENT_CONFIG_API_ENDPOINTS = {
  profiles: "/api/profiles",
  config: "/api/config",
  configDefaults: "/api/config/defaults",
  configSchema: "/api/config/schema",
  agentConfigs: "/api/agent-configs",
  agentConfig: (agentId: string) =>
    `/api/agent-configs/${encodeURIComponent(agentId)}/config`,
} as const;

export const HERMES_AGENT_CONFIG_API_ENDPOINTS = GATEWAY_AGENT_CONFIG_API_ENDPOINTS;
// NOTE: OpenClaw exposes agent configuration via RPC (`config.get`,
// `config.schema`, `agents.files.*`), not HTTP. See OPENCLAW_MANIFEST.

export const GATEWAY_PORTAL_API_ENDPOINTS = {
  config: (portalSlug: string) =>
    `/api/plugins/portal/${encodeURIComponent(portalSlug)}/config`,
} as const;

export const GATEWAY_PROBE_ENDPOINTS = {
  health: "/health",
  healthz: "/healthz",
  readyz: "/readyz",
} as const;

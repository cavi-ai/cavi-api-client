export const CAVI_CONTROL_API_ENDPOINTS = {
  costHistory: "/api/plugins/cavi-control/cost/history",
  scoringModel: "/api/plugins/cavi-control/scoring/model",
  deb: {
    root: "/api/plugins/cavi-control/deb",
    profile: "/api/plugins/cavi-control/deb/profile",
    sprint: "/api/plugins/cavi-control/deb/sprint",
    backlog: "/api/plugins/cavi-control/deb/backlog",
    call: "/api/plugins/cavi-control/deb/call",
    backlogItem: (itemId: string) =>
      `/api/plugins/cavi-control/deb/backlog/${encodeURIComponent(itemId)}`,
  },
  operator: {
    root: "/api/plugins/cavi-control/operator",
    snapshot: "/api/plugins/cavi-control/operator/snapshot",
    status: "/api/plugins/cavi-control/operator/status",
    registry: "/api/plugins/cavi-control/operator/registry",
    tasks: "/api/plugins/cavi-control/operator/tasks",
    task: (taskId: string) =>
      `/api/plugins/cavi-control/operator/tasks/${encodeURIComponent(taskId)}`,
    taskDiscourse: (taskId: string) =>
      `/api/plugins/cavi-control/operator/tasks/${encodeURIComponent(taskId)}/discourse`,
    memory: "/api/plugins/cavi-control/operator/memory",
    workerReady: "/api/plugins/cavi-control/operator/worker/ready",
    workerTasks: "/api/plugins/cavi-control/operator/worker/tasks",
  },
  portals: {
    martina: {
      dashboard: "/api/plugins/portal/martina/dashboard",
      config: "/api/plugins/portal/martina/config",
      runs: "/api/plugins/portal/martina/runs",
      run: (runId: string) => `/api/plugins/portal/martina/runs/${encodeURIComponent(runId)}`,
      doctor: "/api/plugins/portal/martina/doctor",
      queuesMove: "/api/plugins/portal/martina/queues/move",
      artifactFile: (bucket: string, name: string) =>
        `/api/plugins/portal/martina/artifacts/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}`,
      artifactPreview: (bucket: string, name: string) =>
        `/api/plugins/portal/martina/artifacts/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}/preview`,
    },
    scout: { dashboard: "/api/plugins/portal/scout/dashboard" },
    angela: { dashboard: "/api/plugins/portal/angela/dashboard" },
    machine: {
      dashboard: "/api/plugins/machine/dashboard",
      inbox: "/api/plugins/machine/inbox",
      media: (filename: string) =>
        `/api/plugins/machine/media?name=${encodeURIComponent(filename)}`,
      tts: "/api/plugins/machine/tts",
      memeJobs: "/api/plugins/machine/meme/jobs",
      ttsProviders: "/api/plugins/machine/tts/providers",
    },
    frontDoor: {
      dashboard: "/api/plugins/front-door/dashboard",
      ideas: "/api/plugins/front-door/ideas",
      idea: (id: string) => `/api/plugins/front-door/ideas/${encodeURIComponent(id)}`,
      ideaPromote: (id: string) =>
        `/api/plugins/front-door/ideas/${encodeURIComponent(id)}/promote`,
      projects: "/api/plugins/front-door/projects",
      project: (id: string) => `/api/plugins/front-door/projects/${encodeURIComponent(id)}`,
      articles: "/api/plugins/front-door/articles",
      memory: "/api/plugins/front-door/memory",
      inbox: "/api/plugins/front-door/inbox",
    },
  },
  portalMemorySnapshot: (teamSlug: string, memberId: string, memoryKey: string) =>
    `/api/plugins/portal-memory/teams/${encodeURIComponent(teamSlug)}/members/${encodeURIComponent(memberId)}/${encodeURIComponent(memoryKey)}`,
} as const;

export const LIBRARY_API_BASE_PATH = "/library/api" as const;

export const LIBRARY_API_ENDPOINTS = {
  root: LIBRARY_API_BASE_PATH,
  search: `${LIBRARY_API_BASE_PATH}/search`,
  ingest: `${LIBRARY_API_BASE_PATH}/ingest`,
  documents: `${LIBRARY_API_BASE_PATH}/documents`,
  fleetStatus: `${LIBRARY_API_BASE_PATH}/fleet-status`,
  status: `${LIBRARY_API_BASE_PATH}/status`,
  inbox: `${LIBRARY_API_BASE_PATH}/inbox`,
  promotable: `${LIBRARY_API_BASE_PATH}/promotable`,
  reviewRequests: `${LIBRARY_API_BASE_PATH}/review-requests`,
  clip: `${LIBRARY_API_BASE_PATH}/clip`,
  clipHealth: `${LIBRARY_API_BASE_PATH}/clip/health`,
  clipSchema: `${LIBRARY_API_BASE_PATH}/clip/schema`,
  clipLogs: `${LIBRARY_API_BASE_PATH}/clip/logs`,
  document: (id: string) => `${LIBRARY_API_BASE_PATH}/documents/${encodeURIComponent(id)}`,
} as const;

export function resolveLibraryApiPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return LIBRARY_API_BASE_PATH;
  if (trimmed.startsWith(LIBRARY_API_BASE_PATH)) return trimmed;
  return `${LIBRARY_API_BASE_PATH}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

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
  asset: (assetId: string) =>
    `${GATEWAY_MEDIA_API_BASE_PATH}/assets/${encodeURIComponent(assetId)}`,
} as const;

export const HERMES_MEDIA_API_ENDPOINTS = GATEWAY_MEDIA_API_ENDPOINTS;
export const OPENCLAW_MEDIA_API_ENDPOINTS = GATEWAY_MEDIA_API_ENDPOINTS;

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
export const OPENCLAW_WIKI_API_ENDPOINTS = GATEWAY_WIKI_API_ENDPOINTS;

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
export const OPENCLAW_AGENT_CONFIG_API_ENDPOINTS = GATEWAY_AGENT_CONFIG_API_ENDPOINTS;

export const GATEWAY_PROBE_ENDPOINTS = {
  healthz: "/healthz",
  readyz: "/readyz",
} as const;

export const CAVI_CONTROL_BASE_PATH = "/cavi-control" as const;

export const OPERATOR_DISPATCH_ENDPOINTS = {
  message: "/api/message",
  operatorEvents: "/operator/events",
  taskReceiptsTemplate: "/cavi-control/api/tasks/{taskId}/receipts",
} as const;

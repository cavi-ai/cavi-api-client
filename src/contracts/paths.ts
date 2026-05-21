export const CAVI_CONTROL_API_ENDPOINTS = {
  costHistory: "/cavi-control/api/cost/history",
  scoringModel: "/cavi-control/api/scoring/model",
  deb: {
    root: "/cavi-control/api/deb",
    profile: "/cavi-control/api/deb/profile",
    sprint: "/cavi-control/api/deb/sprint",
    backlog: "/cavi-control/api/deb/backlog",
    call: "/cavi-control/api/deb/call",
    backlogItem: (itemId: string) =>
      `/cavi-control/api/deb/backlog/${encodeURIComponent(itemId)}`,
  },
  operator: {
    root: "/cavi-control/api/operator",
    snapshot: "/cavi-control/api/operator/snapshot",
    status: "/cavi-control/api/operator/status",
    registry: "/cavi-control/api/operator/registry",
    tasks: "/cavi-control/api/operator/tasks",
    task: (taskId: string) =>
      `/cavi-control/api/operator/tasks/${encodeURIComponent(taskId)}`,
    taskDiscourse: (taskId: string) =>
      `/cavi-control/api/operator/tasks/${encodeURIComponent(taskId)}/discourse`,
    memory: "/cavi-control/api/operator/memory",
    workerReady: "/cavi-control/api/operator/worker/ready",
    workerTasks: "/cavi-control/api/operator/worker/tasks",
  },
  portals: {
    martina: {
      dashboard: "/martina/api/dashboard",
      config: "/martina/api/config",
      runs: "/martina/api/runs",
      run: (runId: string) => `/martina/api/runs/${encodeURIComponent(runId)}`,
      doctor: "/martina/api/doctor",
      queuesMove: "/martina/api/queues/move",
      artifactFile: (bucket: string, name: string) =>
        `/martina/api/artifacts/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}`,
      artifactPreview: (bucket: string, name: string) =>
        `/martina/api/artifacts/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}/preview`,
    },
    scout: { dashboard: "/scout/api/dashboard" },
    angela: { dashboard: "/angela/api/dashboard" },
    machine: {
      dashboard: "/machine/api/dashboard",
      inbox: "/machine/api/inbox",
      media: (filename: string) =>
        `/machine/api/media?name=${encodeURIComponent(filename)}`,
      tts: "/machine/api/tts",
      memeJobs: "/machine/api/meme/jobs",
      ttsProviders: "/machine/api/tts/providers",
    },
    frontDoor: {
      dashboard: "/front-door/api/dashboard",
      ideas: "/front-door/api/ideas",
      idea: (id: string) => `/front-door/api/ideas/${encodeURIComponent(id)}`,
      ideaPromote: (id: string) =>
        `/front-door/api/ideas/${encodeURIComponent(id)}/promote`,
      projects: "/front-door/api/projects",
      project: (id: string) => `/front-door/api/projects/${encodeURIComponent(id)}`,
      articles: "/front-door/api/articles",
      memory: "/front-door/api/memory",
      inbox: "/front-door/api/inbox",
    },
  },
  portalMemorySnapshot: (teamSlug: string, memberId: string, memoryKey: string) =>
    `/cavi-control/api/portal-memory/teams/${encodeURIComponent(teamSlug)}/members/${encodeURIComponent(memberId)}/${encodeURIComponent(memoryKey)}`,
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

export const GATEWAY_SESSION_API_PATHS = {
  list: "/api/sessions/list",
  usage: "/api/sessions/usage",
  preview: "/api/sessions/preview",
  detail: "/api/sessions/detail",
  patch: "/api/sessions/patch",
} as const;

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

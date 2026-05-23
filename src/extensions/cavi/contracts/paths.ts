import { appendHttpQuery } from "../../../contracts/paths.js";

export { appendHttpQuery };

export const CAVI_CONTROL_API_ENDPOINTS = {
  costHistory: "/api/plugins/cavi-control/cost/history",
  scoringModel: "/api/plugins/cavi-control/scoring/model",
  projectBoard: {
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
      run: (runId: string) =>
        `/api/plugins/portal/martina/runs/${encodeURIComponent(runId)}`,
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
      project: (id: string) =>
        `/api/plugins/front-door/projects/${encodeURIComponent(id)}`,
      articles: "/api/plugins/front-door/articles",
      memory: "/api/plugins/front-door/memory",
      inbox: "/api/plugins/front-door/inbox",
    },
  },
  portalMemorySnapshot: (teamSlug: string, memberId: string, memoryKey: string) =>
    `/api/plugins/portal-memory/teams/${encodeURIComponent(teamSlug)}/members/${encodeURIComponent(memberId)}/${encodeURIComponent(memoryKey)}`,
} as const;

function normalizeRelativeApiPath(path: string): string {
  const normalized = path.trim().replace(/^\/+/, "");
  if (!normalized) return "";
  if (normalized.includes("\\")) {
    throw new Error("resolvePortalApiPath: relativePath must not contain backslashes");
  }
  for (const segment of normalized.split("/")) {
    const decoded = decodePathSegment(segment);
    if (decoded === "." || decoded === "..") {
      throw new Error("resolvePortalApiPath: relativePath must stay within portal root");
    }
  }
  return normalized;
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function resolvePortalApiPath(portalId: string, relativePath: string): string {
  const portal = portalId.trim();
  if (!portal) {
    throw new Error("resolvePortalApiPath: missing portalId");
  }
  const path = normalizeRelativeApiPath(relativePath);
  const root = `/api/plugins/portal/${encodeURIComponent(portal)}`;
  return path ? `${root}/${path}` : root;
}

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
  document: (id: string) =>
    `${LIBRARY_API_BASE_PATH}/documents/${encodeURIComponent(id)}`,
} as const;

export function resolveLibraryApiPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return LIBRARY_API_BASE_PATH;
  if (trimmed.startsWith(LIBRARY_API_BASE_PATH)) return trimmed;
  return `${LIBRARY_API_BASE_PATH}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export const CAVI_CONTROL_BASE_PATH = "/cavi-control" as const;

export const OPERATOR_DISPATCH_ENDPOINTS = {
  message: "/api/message",
  operatorEvents: "/operator/events",
  taskReceiptsTemplate: "/cavi-control/api/tasks/{taskId}/receipts",
} as const;

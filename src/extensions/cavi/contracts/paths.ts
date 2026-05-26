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

export type CaviApiPathAppendOptions = {
  boundaryLabel?: string;
  errorPrefix?: string;
};

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function appendCaviApiPath(
  basePath: string,
  relativePath?: string | null,
  options: CaviApiPathAppendOptions = {},
): string {
  const errorPrefix = options.errorPrefix ?? "appendCaviApiPath";
  const boundaryLabel = options.boundaryLabel ?? "base path";
  const base = basePath.trim().replace(/\/+$/u, "");
  if (!base.startsWith("/") || base.startsWith("//")) {
    throw new Error(`${errorPrefix}: basePath must start with "/"`);
  }
  if (base.includes("\\")) {
    throw new Error(`${errorPrefix}: basePath must not contain backslashes`);
  }
  if (/[?#]/u.test(base)) {
    throw new Error(`${errorPrefix}: basePath must not contain query strings or fragments`);
  }

  const raw = relativePath?.trim() ?? "";
  if (!raw || raw === "/") return base;
  if (/^[a-z][a-z\d+.-]*:/iu.test(raw) || raw.startsWith("//")) {
    throw new Error(`${errorPrefix}: relativePath must not be an absolute URL`);
  }
  if (raw.includes("\\")) {
    throw new Error(`${errorPrefix}: relativePath must not contain backslashes`);
  }
  if (/[?#]/u.test(raw)) {
    throw new Error(
      `${errorPrefix}: relativePath must not contain query strings or fragments; use appendHttpQuery for queries`,
    );
  }

  const normalized =
    raw === base
      ? ""
      : raw.startsWith(`${base}/`)
        ? raw.slice(base.length + 1)
        : raw.replace(/^\/+/u, "");
  if (!normalized) return base;

  const segments = normalized.split("/");
  for (const segment of segments) {
    const decoded = decodePathSegment(segment);
    if (
      !segment ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      throw new Error(`${errorPrefix}: relativePath must stay within ${boundaryLabel}`);
    }
  }

  return `${base}/${segments.join("/")}`;
}

export function resolvePortalApiPath(portalId: string, relativePath: string): string {
  const portal = portalId.trim();
  if (!portal) {
    throw new Error("resolvePortalApiPath: missing portalId");
  }
  const root = `/api/plugins/portal/${encodeURIComponent(portal)}`;
  return appendCaviApiPath(root, relativePath, {
    boundaryLabel: "portal root",
    errorPrefix: "resolvePortalApiPath",
  });
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
  return appendCaviApiPath(LIBRARY_API_BASE_PATH, path, {
    errorPrefix: "resolveLibraryApiPath",
  });
}

export const CAVI_CONTROL_BASE_PATH = "/cavi-control" as const;

export const OPERATOR_DISPATCH_ENDPOINTS = {
  message: "/api/message",
  operatorEvents: "/operator/events",
  taskReceiptsTemplate: "/cavi-control/api/tasks/{taskId}/receipts",
} as const;

export const API_PROJECT_BOARD = CAVI_CONTROL_API_ENDPOINTS.projectBoard.root;

/** Project Board HTTP resources. */
export const PROJECT_BOARD_API = {
  root: CAVI_CONTROL_API_ENDPOINTS.projectBoard.root,
  profile: CAVI_CONTROL_API_ENDPOINTS.projectBoard.profile,
  sprint: CAVI_CONTROL_API_ENDPOINTS.projectBoard.sprint,
  backlog: CAVI_CONTROL_API_ENDPOINTS.projectBoard.backlog,
  call: CAVI_CONTROL_API_ENDPOINTS.projectBoard.call,
} as const;

export function projectBoardBacklogItemPath(itemId: string): string {
  return CAVI_CONTROL_API_ENDPOINTS.projectBoard.backlogItem(itemId);
}

export function projectBoardWorkspaceExpectedContractSummary(): string {
  return `GET ${PROJECT_BOARD_API.profile} + ${PROJECT_BOARD_API.sprint} + ${PROJECT_BOARD_API.backlog} (aggregate: GET ${API_PROJECT_BOARD})`;
}

/** Operator-facing hint when Project Board workspace load fails (keep in sync with Project Board adapters). */
export function projectBoardWorkspaceDiagnosticRouteHint(): string {
  return `Project Board routes: ${PROJECT_BOARD_API.profile}, ${PROJECT_BOARD_API.sprint}, ${PROJECT_BOARD_API.backlog}.`;
}

export const API_OPERATOR = CAVI_CONTROL_API_ENDPOINTS.operator.root;

/** Operator control HTTP resources. */
export const OPERATOR_API = {
  snapshot: CAVI_CONTROL_API_ENDPOINTS.operator.snapshot,
  status: CAVI_CONTROL_API_ENDPOINTS.operator.status,
  registry: CAVI_CONTROL_API_ENDPOINTS.operator.registry,
  tasks: CAVI_CONTROL_API_ENDPOINTS.operator.tasks,
  memory: CAVI_CONTROL_API_ENDPOINTS.operator.memory,
  workerReady: CAVI_CONTROL_API_ENDPOINTS.operator.workerReady,
  workerTasks: CAVI_CONTROL_API_ENDPOINTS.operator.workerTasks,
} as const;

export function operatorTaskDiscoursePath(taskId: string): string {
  return CAVI_CONTROL_API_ENDPOINTS.operator.taskDiscourse(taskId);
}

export function operatorControlExpectedContractSummary(): string {
  return [
    "WS operator.snapshot",
    "WS operator.status",
    "WS operator.registry.get",
    "WS operator.tasks.list",
    "WS operator.memory.list",
    "WS operator.worker.ready",
    "WS operator.worker.tasks.list",
    `(fallback: GET ${OPERATOR_API.snapshot} or GET ${OPERATOR_API.status} + ${OPERATOR_API.registry} + ${OPERATOR_API.tasks} + ${OPERATOR_API.memory} + ${OPERATOR_API.workerReady} + ${OPERATOR_API.workerTasks})`,
  ].join(" + ");
}

import { appendHttpQuery } from "../../../contracts/paths.js";

export { appendHttpQuery };

export const CAVI_CONTROL_OPERATOR_API_BASE =
  "/cavi-control/api/operator" as const;
export const CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE =
  "/api/plugins/cavi-control/operator" as const;

export const CAVI_CONTROL_OPERATOR_API = {
  root: CAVI_CONTROL_OPERATOR_API_BASE,
  snapshot: `${CAVI_CONTROL_OPERATOR_API_BASE}/snapshot`,
  status: `${CAVI_CONTROL_OPERATOR_API_BASE}/status`,
  registry: `${CAVI_CONTROL_OPERATOR_API_BASE}/registry`,
  tasks: `${CAVI_CONTROL_OPERATOR_API_BASE}/tasks`,
  task: (taskId: string) =>
    `${CAVI_CONTROL_OPERATOR_API_BASE}/tasks/${encodeURIComponent(taskId)}`,
  taskDiscourse: (taskId: string) =>
    `${CAVI_CONTROL_OPERATOR_API_BASE}/tasks/${encodeURIComponent(taskId)}/discourse`,
  memory: `${CAVI_CONTROL_OPERATOR_API_BASE}/memory`,
  workerReady: `${CAVI_CONTROL_OPERATOR_API_BASE}/worker/ready`,
  workerTasks: `${CAVI_CONTROL_OPERATOR_API_BASE}/worker/tasks`,
} as const;

/**
 * The gateway mounts the operator API at two paths: the canonical
 * `/cavi-control/api/operator` and a generic plugin route
 * `/api/plugins/cavi-control/operator`. `operator-control-live` issues each
 * request against the canonical path with this plugin-alias path as a fallback,
 * so both tables are kept key-for-key identical.
 */
export const CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS = {
  root: CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE,
  snapshot: `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/snapshot`,
  status: `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/status`,
  registry: `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/registry`,
  tasks: `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/tasks`,
  task: (taskId: string) =>
    `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/tasks/${encodeURIComponent(taskId)}`,
  taskDiscourse: (taskId: string) =>
    `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/tasks/${encodeURIComponent(taskId)}/discourse`,
  memory: `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/memory`,
  workerReady: `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/worker/ready`,
  workerTasks: `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE}/worker/tasks`,
} as const;

// Operator-plane RPC methods only. Harness health lives in core (current
// `health`, with legacy `health.snapshot` fallback). If the cavi-control plugin
// later exposes a distinct operator-plane health probe, add it with a consumer
// and a `cavi-control.*` name; don't shadow the core method.
export const CAVI_CONTROL_OPERATOR_RPC_METHODS = {
  status: "operator.status",
  registry: "operator.registry.get",
  snapshot: "operator.snapshot",
  memoryList: "operator.memory.list",
  tasksList: "operator.tasks.list",
  tasksGet: "operator.tasks.get",
  discourseTree: "discourse.tree",
  workerReady: "operator.worker.ready",
  workerTasksList: "operator.worker.tasks.list",
  workerTasksGet: "operator.worker.tasks.get",
} as const;

export const CAVI_CONTROL_OPERATOR_RPC_METHOD_LIST = Object.values(
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
);

export const CAVI_CONTROL_API_ENDPOINTS = {
  costHistory: "/api/plugins/cavi-control/cost/history",
  scoringModel: "/api/plugins/cavi-control/scoring/model",
  projectBoard: {
    root: "/api/plugins/cavi-control/kanban",
    profile: "/api/plugins/cavi-control/kanban/profile",
    sprint: "/api/plugins/cavi-control/kanban/sprint",
    backlog: "/api/plugins/cavi-control/kanban/backlog",
    call: "/api/plugins/cavi-control/kanban/call",
    backlogItem: (itemId: string) =>
      `/api/plugins/cavi-control/kanban/backlog/${encodeURIComponent(itemId)}`,
  },
  operator: CAVI_CONTROL_OPERATOR_API,
  // Per-agent portal/plugin surfaces are NOT baked in here — they are declared as
  // member actions in the host team manifest and resolved via resolveTeamActionApiPath.
  // Use resolvePortalApiPath for the generic `/api/plugins/portal/{portal}/…` dispatcher.
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

export function projectBoardBacklogItemPath(itemId: string): string {
  return CAVI_CONTROL_API_ENDPOINTS.projectBoard.backlogItem(itemId);
}

export function projectBoardWorkspaceExpectedContractSummary(): string {
  const pb = CAVI_CONTROL_API_ENDPOINTS.projectBoard;
  return `GET ${pb.profile} + ${pb.sprint} + ${pb.backlog} (aggregate: GET ${pb.root})`;
}

/** Operator-facing hint when Project Board workspace load fails (keep in sync with Project Board adapters). */
export function projectBoardWorkspaceDiagnosticRouteHint(): string {
  const pb = CAVI_CONTROL_API_ENDPOINTS.projectBoard;
  return `Project Board routes: ${pb.profile}, ${pb.sprint}, ${pb.backlog}.`;
}

export function operatorTaskDiscoursePath(taskId: string): string {
  return CAVI_CONTROL_OPERATOR_API.taskDiscourse(taskId);
}

export function operatorTaskDiscoursePluginAliasPath(taskId: string): string {
  return CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.taskDiscourse(taskId);
}

export function operatorControlExpectedContractSummary(): string {
  const op = CAVI_CONTROL_OPERATOR_API;
  const opAlias = CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS;
  return [
    `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.snapshot}`,
    `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.status}`,
    `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.registry}`,
    `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.tasksList}`,
    `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.memoryList}`,
    `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.workerReady}`,
    `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.workerTasksList}`,
    `(fallback: GET ${op.snapshot} or ${opAlias.snapshot}; sections: GET ${op.status} + ${op.registry} + ${op.tasks} + ${op.memory} + ${op.workerReady} + ${op.workerTasks} with plugin aliases)`,
  ].join(" + ");
}

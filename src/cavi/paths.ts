import { CAVI_CONTROL_API_ENDPOINTS } from "../contracts/paths.js";

export * from "../contracts/paths.js";

export const API_DEB = CAVI_CONTROL_API_ENDPOINTS.deb.root;

/** Deb HTTP resources. */
export const DEB_API = {
  root: CAVI_CONTROL_API_ENDPOINTS.deb.root,
  profile: CAVI_CONTROL_API_ENDPOINTS.deb.profile,
  sprint: CAVI_CONTROL_API_ENDPOINTS.deb.sprint,
  backlog: CAVI_CONTROL_API_ENDPOINTS.deb.backlog,
  call: CAVI_CONTROL_API_ENDPOINTS.deb.call,
} as const;

export function debBacklogItemPath(itemId: string): string {
  return CAVI_CONTROL_API_ENDPOINTS.deb.backlogItem(itemId);
}

export function debWorkspaceExpectedContractSummary(): string {
  return `GET ${DEB_API.profile} + ${DEB_API.sprint} + ${DEB_API.backlog} (aggregate: GET ${API_DEB})`;
}

/** Operator-facing hint when Deb workspace load fails (keep in sync with Deb adapters). */
export function debWorkspaceDiagnosticRouteHint(): string {
  return `Deb routes: ${DEB_API.profile}, ${DEB_API.sprint}, ${DEB_API.backlog}.`;
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

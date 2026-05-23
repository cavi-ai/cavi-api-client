import { CAVI_CONTROL_API_ENDPOINTS } from "./contracts/paths.js";

export * from "./contracts/paths.js";

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

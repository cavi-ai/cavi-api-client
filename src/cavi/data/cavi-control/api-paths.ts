export const API_OPERATOR = "/cavi-control/api/operator";
export const API_DEB = "/cavi-control/api/deb";

/** Cost time-series (see refs/contracts-pending.md). */
export const API_COST_HISTORY = "/cavi-control/api/cost/history";

/** Pending scoring endpoint; reserved for future UI. */
export const API_SCORING_MODEL = "/cavi-control/api/scoring/model";

/** Deb HTTP resources under `/cavi-control/api/deb`. */
export const DEB_API = {
  root: API_DEB,
  profile: `${API_DEB}/profile`,
  sprint: `${API_DEB}/sprint`,
  backlog: `${API_DEB}/backlog`,
  call: `${API_DEB}/call`,
} as const;

/** Operator control HTTP resources under `/cavi-control/api/operator`. */
export const OPERATOR_API = {
  snapshot: `${API_OPERATOR}/snapshot`,
  status: `${API_OPERATOR}/status`,
  registry: `${API_OPERATOR}/registry`,
  tasks: `${API_OPERATOR}/tasks`,
  memory: `${API_OPERATOR}/memory`,
  workerReady: `${API_OPERATOR}/worker/ready`,
  workerTasks: `${API_OPERATOR}/worker/tasks`,
} as const;

export function debBacklogItemPath(itemId: string): string {
  return `${DEB_API.backlog}/${encodeURIComponent(itemId)}`;
}

export function operatorTaskDiscoursePath(taskId: string): string {
  return `${API_OPERATOR}/tasks/${encodeURIComponent(taskId)}/discourse`;
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

/** Human-readable contract line for envelopes and diagnostics. */
export function describeHttpContract(
  method: string,
  path: string,
  bodyHint?: string,
): string {
  const base = `${method} ${path}`;
  return bodyHint ? `${base} ${bodyHint}` : base;
}

export function debWorkspaceExpectedContractSummary(): string {
  return `GET ${DEB_API.profile} + ${DEB_API.sprint} + ${DEB_API.backlog} (compat: GET ${API_DEB})`;
}

/** Operator-facing hint when Deb workspace load fails (keep in sync with Deb adapters). */
export function debWorkspaceDiagnosticRouteHint(): string {
  return `Deb routes: ${DEB_API.profile}, ${DEB_API.sprint}, ${DEB_API.backlog}.`;
}

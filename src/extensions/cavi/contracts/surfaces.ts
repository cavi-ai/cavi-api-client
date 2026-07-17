import type { SurfaceContract } from "../../../contracts/surfaces.js";
import { CAVI_CONTROL_OPERATOR_API } from "./paths.js";

export type { SurfaceContract };

const p = (params: Record<string, string> | undefined, k: string): string => {
  const v = params?.[k];
  if (!v) throw new Error(`CAVI_SURFACE_CONTRACTS: missing path param "${k}"`);
  return encodeURIComponent(v);
};

const raw = (params: Record<string, string> | undefined, k: string): string => {
  const v = params?.[k];
  if (!v) throw new Error(`CAVI_SURFACE_CONTRACTS: missing path param "${k}"`);
  return v;
};

export const CAVI_SURFACE_CONTRACTS: Record<string, SurfaceContract> = {
  "library.fleetStatus": {
    key: "library.fleetStatus",
    method: "GET",
    path: () => "/api/plugins/library/fleet-status",
    degradation: "gap",
    owner: "extensions/cavi/library",
    note: "Fleet library status extension endpoint.",
  },
  "library.status": {
    key: "library.status",
    method: "GET",
    path: () => "/api/plugins/library/status",
    degradation: "gap",
    owner: "extensions/cavi/library",
    note: "Library ingest pipeline counters.",
  },
  "library.inbox": {
    key: "library.inbox",
    method: "GET",
    path: () => "/api/plugins/library/inbox",
    degradation: "gap",
    owner: "extensions/cavi/library",
    note: "Library inbox endpoint.",
  },
  "library.promotable": {
    key: "library.promotable",
    method: "GET",
    path: () => "/api/plugins/library/promotable",
    degradation: "gap",
    owner: "extensions/cavi/library",
    note: "Promotable library rows.",
  },
  "library.reviewRequests": {
    key: "library.reviewRequests",
    method: "GET",
    path: () => "/api/plugins/library/review-requests",
    degradation: "gap",
    owner: "extensions/cavi/library",
    note: "Library review-request rows.",
  },
  "library.search": {
    key: "library.search",
    method: "GET",
    path: () => "/api/plugins/library/search",
    degradation: "gap",
    owner: "extensions/cavi/library",
    note: "Library search endpoint.",
  },
  "library.clip": {
    key: "library.clip",
    method: "POST",
    path: () => "/api/plugins/library/clip",
    degradation: "gap",
    owner: "extensions/cavi/library",
    note: "CaviClip ingest endpoint (URL/text/manual-file capture into the library intake).",
  },
  "portal.dashboard": {
    key: "portal.dashboard",
    method: "GET",
    path: (params) => `/api/plugins/portal/${p(params, "portal")}/dashboard`,
    degradation: "gap",
    owner: "extensions/cavi/portal",
    note: "Portal dashboard aggregate.",
  },
  "portal.config": {
    key: "portal.config",
    method: "POST",
    path: (params) => `/api/plugins/portal/${p(params, "portal")}/config`,
    degradation: "hard",
    owner: "extensions/cavi/portal",
    note: "Portal config patch endpoint.",
  },
  "cavi.costHistory": {
    key: "cavi.costHistory",
    method: "GET",
    path: () => "/api/plugins/cavi-control/cost/history",
    degradation: "gap",
    owner: "extensions/cavi",
    note: "CAVI cost history extension endpoint.",
  },
  "cavi.operator.status": {
    key: "cavi.operator.status",
    method: "GET",
    path: () => CAVI_CONTROL_OPERATOR_API.status,
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator status endpoint.",
  },
  "cavi.operator.snapshot": {
    key: "cavi.operator.snapshot",
    method: "GET",
    path: () => CAVI_CONTROL_OPERATOR_API.snapshot,
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator aggregate snapshot endpoint.",
  },
  "cavi.operator.tasks": {
    key: "cavi.operator.tasks",
    method: "POST",
    path: () => CAVI_CONTROL_OPERATOR_API.tasks,
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator task create endpoint.",
  },
  "cavi.operator.task": {
    key: "cavi.operator.task",
    method: "GET",
    path: (params) => CAVI_CONTROL_OPERATOR_API.task(raw(params, "taskId")),
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator task detail endpoint.",
  },
  "cavi.operator.taskDiscourse": {
    key: "cavi.operator.taskDiscourse",
    method: "GET",
    path: (params) =>
      CAVI_CONTROL_OPERATOR_API.taskDiscourse(raw(params, "taskId")),
    degradation: "gap",
    owner: "extensions/cavi/discourse",
    note: "CAVI Control operator task discourse endpoint.",
  },
  "cavi.operator.registry": {
    key: "cavi.operator.registry",
    method: "GET",
    path: () => CAVI_CONTROL_OPERATOR_API.registry,
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator registry endpoint.",
  },
  "cavi.operator.memory": {
    key: "cavi.operator.memory",
    method: "GET",
    path: () => CAVI_CONTROL_OPERATOR_API.memory,
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator memory endpoint.",
  },
  "cavi.operator.workerReady": {
    key: "cavi.operator.workerReady",
    method: "GET",
    path: () => CAVI_CONTROL_OPERATOR_API.workerReady,
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator worker readiness endpoint.",
  },
  "cavi.operator.workerTasks": {
    key: "cavi.operator.workerTasks",
    method: "GET",
    path: () => CAVI_CONTROL_OPERATOR_API.workerTasks,
    degradation: "gap",
    owner: "extensions/cavi/operator-control",
    note: "CAVI Control operator worker task queue endpoint.",
  },
  "portalMemory.snapshot": {
    key: "portalMemory.snapshot",
    method: "GET",
    path: (params) =>
      `/api/plugins/portal-memory/teams/${p(params, "teamSlug")}/members/${p(params, "memberId")}/${p(params, "memoryKey")}`,
    degradation: "gap",
    owner: "extensions/cavi/portal-memory",
    note: "Portal memory snapshot endpoint.",
  },
};

export const SURFACE_CONTRACTS = CAVI_SURFACE_CONTRACTS;

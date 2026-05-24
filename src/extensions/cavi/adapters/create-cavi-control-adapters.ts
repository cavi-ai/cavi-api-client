import { type GatewayWebSocketClient } from "../../../core/ws/index.js";
import type {
  GatewaySessionRunDetailSnapshot,
  AgentRunsFilters,
  GatewaySessionRunsSnapshot,
  CostHistoryRange,
  CostHistorySnapshot,
  IncidentsSnapshot,
  OverviewSnapshot,
  RoutingMatrixSnapshot,
  SessionsListPayload,
  SessionsPreviewPayload,
  SessionsUsagePayload,
} from "../../../core/gateway/snapshots/contracts.js";
import {
  type DataEnvelope,
  type MutationResult,
  withFallback,
} from "../../../core/gateway/envelope/index.js";
import { createJsonHttpRequest } from "../../../core/http/json-client.js";
import { isSessionAuthMode } from "../runtime/standalone-mode.js";
import type { CaviControlAdapterFallbackProvider } from "../fallbacks/provider.js";
import { createCaviControlAdapterFallbackProvider } from "../fallbacks/provider.js";
import type {
  ProjectBoardBacklogDraft,
  ProjectBoardBacklogItem,
  ProjectBoardCallRequest,
  ProjectBoardCallResult,
  ProjectBoardEmailDraft,
  ProjectBoardEmailRecipient,
  ProjectBoardWorkspaceSnapshot,
  FleetLibrarySnapshot,
  OperatorControlSnapshot,
  TaskDiscourseSnapshot,
} from "../domain/index.js";
import { projectBoardWorkspaceExpectedContractSummary } from "../contracts/paths.js";
import { taskDiscourseExpectedContractSummary } from "../discourse/contracts.js";
import { resolveGatewayHttpBase } from "../runtime/paths.js";
import { createProjectBoardLiveHelpers } from "../project-board/live.js";
import { createProjectBoardMutations } from "../project-board/mutations.js";
import { loadTaskDiscourseLive } from "../discourse/live.js";
import { createGatewayWsLoaders } from "./cavi-control-adapters/gateway-ws-loaders.js";
import type {
  CaviSnapshotFallbackMode,
  CreateGatewayWsSnapshotLoadersOptions,
} from "./cavi-control-adapters/gateway-ws-snapshot-loaders.js";
import { loadFleetLibraryLive } from "./cavi-control-adapters/library-live.js";
import { loadOperatorControlLive } from "./cavi-control-adapters/operator-control-live.js";

export type CaviControlAdapters = {
  loadSessionsListRaw: (params: {
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    includeDerivedTitles?: boolean;
    limit?: number;
    activeMinutes?: number;
    search?: string;
    label?: string;
    spawnedBy?: string;
    agentId?: string;
  }) => Promise<SessionsListPayload & {
    hash?: string;
    count?: number;
    ts?: number;
    path?: string;
  }>;
  loadSessionsUsageRaw: (params: {
    key?: string;
    limit?: number;
    includeContextWeight?: boolean;
    startDate?: string;
    endDate?: string;
  }) => Promise<SessionsUsagePayload>;
  loadSessionsPreviewRaw: (params: {
    keys: string[];
    limit?: number;
    maxChars?: number;
  }) => Promise<SessionsPreviewPayload>;
  loadSessionDetailRaw: (params: {
    key: string;
    previewLimit?: number;
    maxChars?: number;
  }) => Promise<{
    key?: string;
    row?: unknown | null;
    usageSession?: unknown | null;
    preview?: unknown | null;
    errors?: {
      usage?: string | null;
    };
  }>;
  patchSessionRaw: (params: {
    key: string;
    label?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
  }) => Promise<void>;
  loadOverview: () => Promise<DataEnvelope<OverviewSnapshot>>;
  loadAgentRuns: (
    filters: AgentRunsFilters,
  ) => Promise<DataEnvelope<GatewaySessionRunsSnapshot>>;
  loadRunDetail: (key: string) => Promise<DataEnvelope<GatewaySessionRunDetailSnapshot>>;
  loadRoutingMatrix: (
    windowDays: number,
  ) => Promise<DataEnvelope<RoutingMatrixSnapshot>>;
  loadIncidents: () => Promise<DataEnvelope<IncidentsSnapshot>>;
  loadOperatorControl: () => Promise<DataEnvelope<OperatorControlSnapshot>>;
  loadProjectBoardWorkspace: () => Promise<DataEnvelope<ProjectBoardWorkspaceSnapshot>>;
  loadTaskDiscourse: (
    taskId: string,
  ) => Promise<DataEnvelope<TaskDiscourseSnapshot>>;
  loadFleetLibrary: () => Promise<FleetLibrarySnapshot>;
  loadCostHistory: (
    range: CostHistoryRange,
  ) => Promise<DataEnvelope<CostHistorySnapshot>>;
  createProjectBoardEmail: (
    draft: ProjectBoardEmailDraft,
  ) => Promise<MutationResult<ProjectBoardEmailRecipient>>;
  updateProjectBoardEmail: (
    emailId: string,
    draft: ProjectBoardEmailDraft,
  ) => Promise<MutationResult<ProjectBoardEmailRecipient>>;
  removeProjectBoardEmail: (emailId: string) => Promise<MutationResult<{ id: string }>>;
  createProjectBoardBacklogItem: (
    draft: ProjectBoardBacklogDraft,
  ) => Promise<MutationResult<ProjectBoardBacklogItem>>;
  updateProjectBoardBacklogItem: (
    itemId: string,
    draft: ProjectBoardBacklogDraft,
  ) => Promise<MutationResult<ProjectBoardBacklogItem>>;
  callProjectBoard: (
    request: ProjectBoardCallRequest,
  ) => Promise<MutationResult<ProjectBoardCallResult>>;
};

function createEmptyProjectBoardWorkspace(): ProjectBoardWorkspaceSnapshot {
  const now = Date.now();
  const limitations = [
    "Generic fallback only. Pass caviFallbacks.projectBoardWorkspace to provide product data.",
  ] as const;
  return {
    profile: {
      name: "Project Board",
      role: "Project board operator",
      photoPath: null,
      photoUrl: null,
      avatarCandidates: [],
      emails: [],
      lastUpdated: now,
      storage: "json-file",
      limitations,
    },
    emails: [],
    sprint: {
      sprint: {
        id: "default",
        name: "Default sprint",
        goal: "",
        startsOn: null,
        endsOn: null,
      },
      statusMetrics: {
        total: 0,
        todo: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
        completionRate: 0,
      },
      lastUpdated: now,
      storage: "json-file",
      limitations,
    },
    backlog: {
      sections: [],
      priorities: { p0: 0, p1: 0, p2: 0, p3: 0 },
      statusCounters: { todo: 0, in_progress: 0, blocked: 0, done: 0 },
      totalItems: 0,
      lastUpdated: now,
      storage: "json-file",
      limitations,
    },
  };
}

function createEmptyTaskDiscourse(taskId: string): TaskDiscourseSnapshot {
  return {
    rootTaskId: taskId.trim() || "task",
    agents: [],
    events: [],
    delegationTree: [],
    summary: {
      totalAgents: 0,
      totalEvents: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      durationMs: null,
      blockerCount: 0,
      decisionCount: 0,
      outcome: "pending",
    },
  };
}

function resolveProjectBoardWorkspaceFallback(
  fallbacks: CaviControlAdapterFallbackProvider["cavi"],
): ProjectBoardWorkspaceSnapshot {
  const fallback = fallbacks?.projectBoardWorkspace;
  if (!fallback) {
    return createEmptyProjectBoardWorkspace();
  }
  return typeof fallback === "function" ? fallback() : fallback;
}

function resolveTaskDiscourseFallback(
  fallbacks: CaviControlAdapterFallbackProvider["cavi"],
  taskId: string,
): TaskDiscourseSnapshot {
  const fallback = fallbacks?.taskDiscourse;
  if (!fallback) {
    return createEmptyTaskDiscourse(taskId);
  }
  return typeof fallback === "function" ? fallback(taskId) : fallback;
}

export function createCaviControlAdapters(opts: {
  gatewayBaseUrl: string;
  authToken: string | null;
  apiBaseUrl?: string | null;
  client?: GatewayWebSocketClient | null;
  fallbackMode?: CaviSnapshotFallbackMode;
  fallbackProvider?: CaviControlAdapterFallbackProvider | null;
  snapshotFallbacks?: CreateGatewayWsSnapshotLoadersOptions["snapshotFallbacks"];
  costHistoryFallback?: CreateGatewayWsSnapshotLoadersOptions["costHistoryFallback"];
  caviFallbacks?: CaviControlAdapterFallbackProvider["cavi"];
  resolveSnapshotBinding?: CreateGatewayWsSnapshotLoadersOptions["resolveBinding"];
}): CaviControlAdapters {
  const httpBase =
    opts.apiBaseUrl?.trim() || resolveGatewayHttpBase(opts.gatewayBaseUrl);

  const sessionMode = isSessionAuthMode();
  const fallbackProvider = opts.fallbackProvider ??
    (opts.fallbackMode === "compat"
      ? createCaviControlAdapterFallbackProvider()
      : null);
  const caviFallbacks = {
    ...(fallbackProvider?.cavi ?? {}),
    ...(opts.caviFallbacks ?? {}),
  };
  const requestJson = createJsonHttpRequest({
    surface: "cavi-control-api",
    httpBase,
    authToken: sessionMode ? null : opts.authToken,
    credentials: sessionMode ? "same-origin" : undefined,
  });

  const projectBoardLive = createProjectBoardLiveHelpers(requestJson);
  const projectBoardMutations = createProjectBoardMutations(requestJson, projectBoardLive);
  const gatewayWs = createGatewayWsLoaders({
    client: opts.client,
    requestJson,
    snapshotOptions: {
      fallbackMode: opts.fallbackMode,
      fallbackProvider,
      snapshotFallbacks: opts.snapshotFallbacks,
      costHistoryFallback: opts.costHistoryFallback,
      resolveBinding: opts.resolveSnapshotBinding,
    },
  });
  const inFlightLoads = new Map<string, Promise<unknown>>();

  const shareInFlight = async <TData>(
    key: string,
    run: () => Promise<TData>,
  ): Promise<TData> => {
    const existing = inFlightLoads.get(key);
    if (existing) {
      return (await existing) as TData;
    }

    const next = run().finally(() => {
      inFlightLoads.delete(key);
    });
    inFlightLoads.set(key, next);
    return await next;
  };

  return {
    loadSessionsListRaw: gatewayWs.loadSessionsListRaw,
    loadSessionsUsageRaw: gatewayWs.loadSessionsUsageRaw,
    loadSessionsPreviewRaw: gatewayWs.loadSessionsPreviewRaw,
    loadSessionDetailRaw: gatewayWs.loadSessionDetailRaw,
    patchSessionRaw: gatewayWs.patchSessionRaw,
    loadOverview: gatewayWs.loadOverview,
    loadAgentRuns: gatewayWs.loadAgentRuns,
    loadRunDetail: gatewayWs.loadRunDetail,
    loadRoutingMatrix: gatewayWs.loadRoutingMatrix,
    loadIncidents: gatewayWs.loadIncidents,
    loadCostHistory: async (range) =>
      await shareInFlight(`cost-history:${range}`, async () =>
        await gatewayWs.loadCostHistory(range),
      ),

    loadFleetLibrary: async () =>
      await shareInFlight("fleet-library", async () =>
        await loadFleetLibraryLive(requestJson),
      ),

    loadOperatorControl: async () =>
      await shareInFlight("operator-control", async () =>
        await loadOperatorControlLive(
          requestJson,
          opts.client,
          caviFallbacks.operatorControl,
        ),
      ),

    loadTaskDiscourse: async (taskId) =>
      await shareInFlight(`task-discourse:${taskId.trim()}`, async () =>
        withFallback({
          area: "task-discourse",
          expectedContract: taskDiscourseExpectedContractSummary(),
          note: "Task discourse snapshot unavailable",
          fallback: resolveTaskDiscourseFallback(caviFallbacks, taskId),
          run: async () =>
            await loadTaskDiscourseLive(requestJson, opts.client, taskId),
        }),
      ),

    loadProjectBoardWorkspace: async () =>
      await shareInFlight("project-board-workspace", async () =>
        withFallback({
          area: "project-board-workspace",
          expectedContract: projectBoardWorkspaceExpectedContractSummary(),
          note: "Project Board workspace APIs unavailable",
          fallback: resolveProjectBoardWorkspaceFallback(caviFallbacks),
          run: async () => await projectBoardLive.loadProjectBoardWorkspaceLive(),
        }),
      ),

    createProjectBoardEmail: projectBoardMutations.createProjectBoardEmail,
    updateProjectBoardEmail: projectBoardMutations.updateProjectBoardEmail,
    removeProjectBoardEmail: projectBoardMutations.removeProjectBoardEmail,
    createProjectBoardBacklogItem: projectBoardMutations.createProjectBoardBacklogItem,
    updateProjectBoardBacklogItem: projectBoardMutations.updateProjectBoardBacklogItem,
    callProjectBoard: projectBoardMutations.callProjectBoard,
  };
}

import { type GatewayWebSocketClient } from "../../core/ws/index.js";
import type {
  SessionsListPayload,
  SessionsPreviewPayload,
  SessionsUsagePayload,
} from "../../core/gateway/transforms.js";
import {
  type DataEnvelope,
  type MutationResult,
  withFallback,
} from "../../core/gateway/envelope.js";
import { createJsonHttpRequest } from "../../core/http/json-client.js";
import { isSessionAuthMode } from "../runtime/standalone-mode.js";
import type {
  AgentRunDetailSnapshot,
  AgentRunsFilters,
  AgentRunsSnapshot,
  CostHistoryRange,
  CostHistorySnapshot,
  DebBacklogDraft,
  DebBacklogItem,
  DebCallRequest,
  DebCallResult,
  DebEmailDraft,
  DebEmailRecipient,
  DebWorkspaceSnapshot,
  FleetLibrarySnapshot,
  IncidentsSnapshot,
  OperatorControlSnapshot,
  OverviewSnapshot,
  RoutingMatrixSnapshot,
  TaskDiscourseSnapshot,
} from "../domain/index.js";
import { fallbackDebWorkspace, fallbackTaskDiscourse } from "../fallbacks/snapshots/index.js";
import { debWorkspaceExpectedContractSummary } from "../paths.js";
import { taskDiscourseExpectedContractSummary } from "../discourse/contracts.js";
import { resolveGatewayHttpBase } from "../runtime/paths.js";
import { createDebLiveHelpers } from "../deb/live.js";
import { createDebMutations } from "../deb/mutations.js";
import { loadTaskDiscourseLive } from "../discourse/live.js";
import { createGatewayWsLoaders } from "./cavi-control-adapters/gateway-ws-loaders.js";
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
  ) => Promise<DataEnvelope<AgentRunsSnapshot>>;
  loadRunDetail: (key: string) => Promise<DataEnvelope<AgentRunDetailSnapshot>>;
  loadRoutingMatrix: (
    windowDays: number,
  ) => Promise<DataEnvelope<RoutingMatrixSnapshot>>;
  loadIncidents: () => Promise<DataEnvelope<IncidentsSnapshot>>;
  loadOperatorControl: () => Promise<DataEnvelope<OperatorControlSnapshot>>;
  loadDebWorkspace: () => Promise<DataEnvelope<DebWorkspaceSnapshot>>;
  loadTaskDiscourse: (
    taskId: string,
  ) => Promise<DataEnvelope<TaskDiscourseSnapshot>>;
  loadFleetLibrary: () => Promise<FleetLibrarySnapshot>;
  loadCostHistory: (
    range: CostHistoryRange,
  ) => Promise<DataEnvelope<CostHistorySnapshot>>;
  createDebEmail: (
    draft: DebEmailDraft,
  ) => Promise<MutationResult<DebEmailRecipient>>;
  updateDebEmail: (
    emailId: string,
    draft: DebEmailDraft,
  ) => Promise<MutationResult<DebEmailRecipient>>;
  removeDebEmail: (emailId: string) => Promise<MutationResult<{ id: string }>>;
  createDebBacklogItem: (
    draft: DebBacklogDraft,
  ) => Promise<MutationResult<DebBacklogItem>>;
  updateDebBacklogItem: (
    itemId: string,
    draft: DebBacklogDraft,
  ) => Promise<MutationResult<DebBacklogItem>>;
  callDeb: (request: DebCallRequest) => Promise<MutationResult<DebCallResult>>;
};

export function createCaviControlAdapters(opts: {
  gatewayBaseUrl: string;
  authToken: string | null;
  apiBaseUrl?: string | null;
  client?: GatewayWebSocketClient | null;
}): CaviControlAdapters {
  const httpBase =
    opts.apiBaseUrl?.trim() || resolveGatewayHttpBase(opts.gatewayBaseUrl);

  const sessionMode = isSessionAuthMode();
  const requestJson = createJsonHttpRequest({
    surface: "cavi-control-api",
    httpBase,
    authToken: sessionMode ? null : opts.authToken,
    credentials: sessionMode ? "same-origin" : undefined,
  });

  const debLive = createDebLiveHelpers(requestJson);
  const debMutations = createDebMutations(requestJson, debLive);
  const gatewayWs = createGatewayWsLoaders({
    client: opts.client,
    requestJson,
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
        await loadOperatorControlLive(requestJson, opts.client),
      ),

    loadTaskDiscourse: async (taskId) =>
      await shareInFlight(`task-discourse:${taskId.trim()}`, async () =>
        withFallback({
          area: "task-discourse",
          expectedContract: taskDiscourseExpectedContractSummary(),
          note: "Task discourse snapshot unavailable",
          fallback: fallbackTaskDiscourse(taskId),
          run: async () =>
            await loadTaskDiscourseLive(requestJson, opts.client, taskId),
        }),
      ),

    loadDebWorkspace: async () =>
      await shareInFlight("deb-workspace", async () =>
        withFallback({
          area: "deb-workspace",
          expectedContract: debWorkspaceExpectedContractSummary(),
          note: "Deb workspace APIs unavailable",
          fallback: fallbackDebWorkspace,
          run: async () => await debLive.loadDebWorkspaceLive(),
        }),
      ),

    createDebEmail: debMutations.createDebEmail,
    updateDebEmail: debMutations.updateDebEmail,
    removeDebEmail: debMutations.removeDebEmail,
    createDebBacklogItem: debMutations.createDebBacklogItem,
    updateDebBacklogItem: debMutations.updateDebBacklogItem,
    callDeb: debMutations.callDeb,
  };
}

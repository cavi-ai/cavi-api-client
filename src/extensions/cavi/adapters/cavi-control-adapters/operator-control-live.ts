import type { GatewayWebSocketClient } from "../../../../core/ws/index.js";
import {
  fallbackGap,
  type ContractGap,
  type DataEnvelope,
} from "../../../../core/gateway/envelope/index.js";
import {
  type JsonHttpRequest,
  withQuery,
} from "../../../../core/http/json-client.js";
import type {
  OperatorControlSnapshot,
} from "../../domain/index.js";
import {
  OPERATOR_MEMORY_SAMPLE_LIMIT,
  OPERATOR_TASK_SAMPLE_LIMIT,
  OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
} from "../../operator-control/constants.js";
import {
  createEmptyOperatorMemory,
  createEmptyOperatorRegistry,
  createEmptyOperatorStatus,
  createEmptyOperatorTasks,
  createEmptyWorkerReady,
  createEmptyWorkerTasks,
} from "../../operator-control/defaults.js";
import {
  CAVI_CONTROL_OPERATOR_API as OPERATOR_API,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS as OPERATOR_API_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
  operatorControlExpectedContractSummary,
} from "../../contracts/paths.js";
import { loadOperatorControlSection } from "../../operator-control/load-section.js";

const OPERATOR_FULL_FALLBACK_BACKOFF_MS = 15_000;
const fullFallbackByRequestJson = new WeakMap<
  JsonHttpRequest,
  {
    expiresAt: number;
    envelope: DataEnvelope<OperatorControlSnapshot>;
  }
>();

function expectedContract(wsContract: string, httpPath: string): string {
  return `${wsContract} (fallback: GET ${httpPath})`;
}

async function requestJsonWithAlias<TData>(
  requestJson: JsonHttpRequest,
  primaryPath: string,
  aliasPath?: string | null,
): Promise<TData> {
  try {
    return await requestJson<TData>(primaryPath);
  } catch (primaryError) {
    if (!aliasPath || aliasPath === primaryPath) {
      throw primaryError;
    }
    return await requestJson<TData>(aliasPath);
  }
}

function buildAvailableSectionStatus(params: {
  tasksLimit: number;
  memoryLimit: number;
  workerTasksLimit: number;
}): OperatorControlSnapshot["sectionStatus"] {
  return {
    status: {
      available: true,
      authoritative: true,
      error: null,
      sampleLimit: null,
    },
    registryDetail: {
      available: true,
      authoritative: true,
      error: null,
      sampleLimit: null,
    },
    tasks: {
      available: true,
      authoritative: false,
      error: null,
      sampleLimit: params.tasksLimit,
    },
    memory: {
      available: true,
      authoritative: false,
      error: null,
      sampleLimit: params.memoryLimit,
    },
    workerReady: {
      available: true,
      authoritative: true,
      error: null,
      sampleLimit: null,
    },
    workerTasks: {
      available: true,
      authoritative: false,
      error: null,
      sampleLimit: params.workerTasksLimit,
    },
  };
}

export type OperatorControlFallback =
  | OperatorControlSnapshot
  | (() => OperatorControlSnapshot);

function createUnavailableSectionStatus(): OperatorControlSnapshot["sectionStatus"] {
  const unavailable = {
    available: false,
    authoritative: false,
    error: "Operator control unavailable",
    sampleLimit: null,
  };
  return {
    status: { ...unavailable, authoritative: true },
    registryDetail: { ...unavailable, authoritative: true },
    tasks: { ...unavailable, sampleLimit: OPERATOR_TASK_SAMPLE_LIMIT },
    memory: { ...unavailable, sampleLimit: OPERATOR_MEMORY_SAMPLE_LIMIT },
    workerReady: { ...unavailable, authoritative: true },
    workerTasks: { ...unavailable, sampleLimit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT },
  };
}

function createEmptyOperatorControlSnapshot(): OperatorControlSnapshot {
  return {
    status: createEmptyOperatorStatus(),
    registryDetail: createEmptyOperatorRegistry(),
    tasks: createEmptyOperatorTasks(),
    memory: createEmptyOperatorMemory(),
    workerReady: createEmptyWorkerReady(),
    workerTasks: createEmptyWorkerTasks(),
    sectionStatus: createUnavailableSectionStatus(),
  };
}

function resolveOperatorControlFallback(
  fallback?: OperatorControlFallback | null,
): OperatorControlSnapshot {
  if (!fallback) {
    return createEmptyOperatorControlSnapshot();
  }
  return typeof fallback === "function" ? fallback() : fallback;
}

async function requestOperatorSnapshot(params: {
  client: GatewayWebSocketClient | null | undefined;
  requestJson: JsonHttpRequest;
}): Promise<OperatorControlSnapshot> {
  const snapshotParams = {
    taskLimit: OPERATOR_TASK_SAMPLE_LIMIT,
    memoryLimit: OPERATOR_MEMORY_SAMPLE_LIMIT,
    workerTaskLimit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
  };
  const httpPath = withQuery(OPERATOR_API.snapshot, snapshotParams);
  const httpAliasPath = withQuery(OPERATOR_API_PLUGIN_ALIAS.snapshot, snapshotParams);
  if (params.client) {
    try {
      return await params.client.request<OperatorControlSnapshot>(
        CAVI_CONTROL_OPERATOR_RPC_METHODS.snapshot,
        snapshotParams,
      );
    } catch {
      // Ignore WS aggregate failures and continue with the HTTP aggregate endpoint.
    }
  }

  return await requestJsonWithAlias<OperatorControlSnapshot>(
    params.requestJson,
    httpPath,
    httpAliasPath,
  );
}

async function requestOperatorSection<TData>(params: {
  client: GatewayWebSocketClient | null | undefined;
  requestJson: JsonHttpRequest;
  wsMethod: string;
  wsParams?: Record<string, unknown>;
  httpPath: string;
  httpAliasPath?: string | null;
}): Promise<TData> {
  if (params.client) {
    try {
      return await params.client.request<TData>(params.wsMethod, params.wsParams ?? {});
    } catch {
      // Ignore WS failures and continue with the HTTP operator endpoint.
    }
  }

  return await requestJsonWithAlias<TData>(
    params.requestJson,
    params.httpPath,
    params.httpAliasPath,
  );
}

export async function loadOperatorControlLive(
  requestJson: JsonHttpRequest,
  client: GatewayWebSocketClient | null | undefined,
  fallback?: OperatorControlFallback | null,
): Promise<DataEnvelope<OperatorControlSnapshot>> {
  const cachedFullFallback = fullFallbackByRequestJson.get(requestJson);
  if (cachedFullFallback && cachedFullFallback.expiresAt > Date.now()) {
    return {
      ...cachedFullFallback.envelope,
      fetchedAt: Date.now(),
    };
  }

  try {
    const aggregate = await requestOperatorSnapshot({ client, requestJson });
    fullFallbackByRequestJson.delete(requestJson);
    return {
      data: {
        ...aggregate,
        sectionStatus:
          aggregate.sectionStatus ??
          buildAvailableSectionStatus({
            tasksLimit: OPERATOR_TASK_SAMPLE_LIMIT,
            memoryLimit: OPERATOR_MEMORY_SAMPLE_LIMIT,
            workerTasksLimit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
          }),
      },
      source: "gateway",
      fetchedAt: Date.now(),
      contractGaps: [],
    };
  } catch {
    // Fall back to section-by-section reads for older gateways or partial outages.
  }

  const [
    statusResult,
    registryResult,
    tasksResult,
    memoryResult,
    workerReadyResult,
    workerTasksResult,
  ] = await Promise.all([
    loadOperatorControlSection({
      key: "status",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["status"]>({
          client,
          requestJson,
          wsMethod: CAVI_CONTROL_OPERATOR_RPC_METHODS.status,
          httpPath: OPERATOR_API.status,
          httpAliasPath: OPERATOR_API_PLUGIN_ALIAS.status,
        }),
      fallback: createEmptyOperatorStatus,
      authoritative: true,
      sampleLimit: null,
      expectedContract: expectedContract(
        `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.status}`,
        OPERATOR_API.status,
      ),
      note: "Operator status unavailable",
    }),
    loadOperatorControlSection({
      key: "registryDetail",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["registryDetail"]>({
          client,
          requestJson,
          wsMethod: CAVI_CONTROL_OPERATOR_RPC_METHODS.registry,
          httpPath: OPERATOR_API.registry,
          httpAliasPath: OPERATOR_API_PLUGIN_ALIAS.registry,
        }),
      fallback: createEmptyOperatorRegistry,
      authoritative: true,
      sampleLimit: null,
      expectedContract: expectedContract(
        `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.registry}`,
        OPERATOR_API.registry,
      ),
      note: "Operator registry unavailable",
    }),
    loadOperatorControlSection({
      key: "tasks",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["tasks"]>({
          client,
          requestJson,
          wsMethod: CAVI_CONTROL_OPERATOR_RPC_METHODS.tasksList,
          wsParams: { limit: OPERATOR_TASK_SAMPLE_LIMIT },
          httpPath: withQuery(OPERATOR_API.tasks, {
            limit: OPERATOR_TASK_SAMPLE_LIMIT,
          }),
          httpAliasPath: withQuery(OPERATOR_API_PLUGIN_ALIAS.tasks, {
            limit: OPERATOR_TASK_SAMPLE_LIMIT,
          }),
        }),
      fallback: createEmptyOperatorTasks,
      authoritative: false,
      sampleLimit: OPERATOR_TASK_SAMPLE_LIMIT,
      expectedContract: expectedContract(
        `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.tasksList}`,
        OPERATOR_API.tasks,
      ),
      note: "Operator task list unavailable",
    }),
    loadOperatorControlSection({
      key: "memory",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["memory"]>({
          client,
          requestJson,
          wsMethod: CAVI_CONTROL_OPERATOR_RPC_METHODS.memoryList,
          wsParams: { limit: OPERATOR_MEMORY_SAMPLE_LIMIT },
          httpPath: withQuery(OPERATOR_API.memory, {
            limit: OPERATOR_MEMORY_SAMPLE_LIMIT,
          }),
          httpAliasPath: withQuery(OPERATOR_API_PLUGIN_ALIAS.memory, {
            limit: OPERATOR_MEMORY_SAMPLE_LIMIT,
          }),
        }),
      fallback: createEmptyOperatorMemory,
      authoritative: false,
      sampleLimit: OPERATOR_MEMORY_SAMPLE_LIMIT,
      expectedContract: expectedContract(
        `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.memoryList}`,
        OPERATOR_API.memory,
      ),
      note: "Operator memory list unavailable",
    }),
    loadOperatorControlSection({
      key: "workerReady",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["workerReady"]>({
          client,
          requestJson,
          wsMethod: CAVI_CONTROL_OPERATOR_RPC_METHODS.workerReady,
          httpPath: OPERATOR_API.workerReady,
          httpAliasPath: OPERATOR_API_PLUGIN_ALIAS.workerReady,
        }),
      fallback: createEmptyWorkerReady,
      authoritative: true,
      sampleLimit: null,
      expectedContract: expectedContract(
        `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.workerReady}`,
        OPERATOR_API.workerReady,
      ),
      note: "Operator worker readiness unavailable",
    }),
    loadOperatorControlSection({
      key: "workerTasks",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["workerTasks"]>({
          client,
          requestJson,
          wsMethod: CAVI_CONTROL_OPERATOR_RPC_METHODS.workerTasksList,
          wsParams: { limit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT },
          httpPath: withQuery(OPERATOR_API.workerTasks, {
            limit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
          }),
          httpAliasPath: withQuery(OPERATOR_API_PLUGIN_ALIAS.workerTasks, {
            limit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
          }),
        }),
      fallback: createEmptyWorkerTasks,
      authoritative: false,
      sampleLimit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
      expectedContract: expectedContract(
        `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.workerTasksList}`,
        OPERATOR_API.workerTasks,
      ),
      note: "Operator worker task list unavailable",
    }),
  ]);

  const contractGaps = [
    statusResult.contractGap,
    registryResult.contractGap,
    tasksResult.contractGap,
    memoryResult.contractGap,
    workerReadyResult.contractGap,
    workerTasksResult.contractGap,
  ].filter((gap): gap is ContractGap => gap !== null);

  const allSectionsUnavailable = [
    statusResult,
    registryResult,
    tasksResult,
    memoryResult,
    workerReadyResult,
    workerTasksResult,
  ].every((result) => !result.status.available);

  if (allSectionsUnavailable) {
    const primaryGap = contractGaps[0];
    const envelope = {
      data: resolveOperatorControlFallback(fallback),
      source: "mock",
      fetchedAt: Date.now(),
      contractGaps: [
        fallbackGap(
          "operator-control",
          operatorControlExpectedContractSummary(),
          primaryGap
            ? `Operator control snapshot unavailable. ${primaryGap.note}`
            : "Operator control snapshot unavailable.",
          primaryGap?.reason ?? "backend-unavailable",
          primaryGap?.httpStatus,
        ),
      ],
    } satisfies DataEnvelope<OperatorControlSnapshot>;
    fullFallbackByRequestJson.set(requestJson, {
      expiresAt: Date.now() + OPERATOR_FULL_FALLBACK_BACKOFF_MS,
      envelope,
    });
    return envelope;
  }

  fullFallbackByRequestJson.delete(requestJson);
  const status = statusResult.data;
  const tasks = tasksResult.status.available
    ? tasksResult.data
    : {
        ...tasksResult.data,
        summary: { ...status.taskSummary.tasks },
      };
  const memory = memoryResult.status.available
    ? memoryResult.data
    : {
        ...memoryResult.data,
        storePath: status.sharedMemory.storePath,
        collections: status.sharedMemory.collections,
      };
  const workerReady = workerReadyResult.data;
  const workerTasks = workerTasksResult.status.available
    ? workerTasksResult.data
    : {
        ...workerTasksResult.data,
        stats: {
          pending: workerReady.pending,
          active: workerReady.active,
          shuttingDown: workerReady.shuttingDown,
        },
      };

  return {
    data: {
      status,
      registryDetail: registryResult.data,
      tasks,
      memory,
      workerReady,
      workerTasks,
      sectionStatus: {
        status: statusResult.status,
        registryDetail: registryResult.status,
        tasks: tasksResult.status,
        memory: memoryResult.status,
        workerReady: workerReadyResult.status,
        workerTasks: workerTasksResult.status,
      },
    },
    source: "gateway",
    fetchedAt: Date.now(),
    contractGaps,
  };
}

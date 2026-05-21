import type { GatewayRpcClient } from "../../../core/gateway/rpc.js";
import type {
  ContractGap,
  DataEnvelope,
  OperatorControlSnapshot,
} from "../../domain/index.js";
import {
  OPERATOR_MEMORY_SAMPLE_LIMIT,
  OPERATOR_TASK_SAMPLE_LIMIT,
  OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
} from "../../data/cavi-control/constants.js";
import {
  createEmptyOperatorMemory,
  createEmptyOperatorRegistry,
  createEmptyOperatorStatus,
  createEmptyOperatorTasks,
  createEmptyWorkerReady,
  createEmptyWorkerTasks,
} from "../../data/cavi-control/operator/defaults.js";
import {
  OPERATOR_API,
  operatorControlExpectedContractSummary,
} from "../../data/cavi-control/api-paths.js";
import { fallbackGap } from "../../data/cavi-control/envelope.js";
import type { CaviControlRequestJson } from "../../data/cavi-control/http-client.js";
import { withQuery } from "../../data/cavi-control/http-client.js";
import { loadOperatorControlSection } from "../../data/cavi-control/operator/load-section.js";
import { fallbackOperatorControl } from "../../fallbacks/snapshots/index.js";

const OPERATOR_FULL_FALLBACK_BACKOFF_MS = 15_000;
const fullFallbackByRequestJson = new WeakMap<
  CaviControlRequestJson,
  {
    expiresAt: number;
    envelope: DataEnvelope<OperatorControlSnapshot>;
  }
>();

function expectedContract(wsContract: string, httpPath: string): string {
  return `${wsContract} (fallback: GET ${httpPath})`;
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

async function requestOperatorSnapshot(params: {
  client: GatewayRpcClient | null | undefined;
  requestJson: CaviControlRequestJson;
}): Promise<OperatorControlSnapshot> {
  const snapshotParams = {
    taskLimit: OPERATOR_TASK_SAMPLE_LIMIT,
    memoryLimit: OPERATOR_MEMORY_SAMPLE_LIMIT,
    workerTaskLimit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
  };
  const httpPath = withQuery(OPERATOR_API.snapshot, snapshotParams);
  if (params.client) {
    try {
      return await params.client.request<OperatorControlSnapshot>(
        "operator.snapshot",
        snapshotParams,
      );
    } catch {
      // Ignore WS aggregate failures and continue with the HTTP aggregate endpoint.
    }
  }

  return await params.requestJson<OperatorControlSnapshot>(httpPath);
}

async function requestOperatorSection<TData>(params: {
  client: GatewayRpcClient | null | undefined;
  requestJson: CaviControlRequestJson;
  wsMethod: string;
  wsParams?: Record<string, unknown>;
  httpPath: string;
}): Promise<TData> {
  if (params.client) {
    try {
      return await params.client.request<TData>(params.wsMethod, params.wsParams ?? {});
    } catch {
      // Ignore WS failures and continue with the HTTP operator endpoint.
    }
  }

  return await params.requestJson<TData>(params.httpPath);
}

export async function loadOperatorControlLive(
  requestJson: CaviControlRequestJson,
  client: GatewayRpcClient | null | undefined,
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
          wsMethod: "operator.status",
          httpPath: OPERATOR_API.status,
        }),
      fallback: createEmptyOperatorStatus,
      authoritative: true,
      sampleLimit: null,
      expectedContract: expectedContract("WS operator.status", OPERATOR_API.status),
      note: "Operator status unavailable",
    }),
    loadOperatorControlSection({
      key: "registryDetail",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["registryDetail"]>({
          client,
          requestJson,
          wsMethod: "operator.registry.get",
          httpPath: OPERATOR_API.registry,
        }),
      fallback: createEmptyOperatorRegistry,
      authoritative: true,
      sampleLimit: null,
      expectedContract: expectedContract("WS operator.registry.get", OPERATOR_API.registry),
      note: "Operator registry unavailable",
    }),
    loadOperatorControlSection({
      key: "tasks",
      run: async () =>
        await requestOperatorSection<OperatorControlSnapshot["tasks"]>({
          client,
          requestJson,
          wsMethod: "operator.tasks.list",
          wsParams: { limit: OPERATOR_TASK_SAMPLE_LIMIT },
          httpPath: withQuery(OPERATOR_API.tasks, {
            limit: OPERATOR_TASK_SAMPLE_LIMIT,
          }),
        }),
      fallback: createEmptyOperatorTasks,
      authoritative: false,
      sampleLimit: OPERATOR_TASK_SAMPLE_LIMIT,
      expectedContract: expectedContract(
        "WS operator.tasks.list",
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
          wsMethod: "operator.memory.list",
          wsParams: { limit: OPERATOR_MEMORY_SAMPLE_LIMIT },
          httpPath: withQuery(OPERATOR_API.memory, {
            limit: OPERATOR_MEMORY_SAMPLE_LIMIT,
          }),
        }),
      fallback: createEmptyOperatorMemory,
      authoritative: false,
      sampleLimit: OPERATOR_MEMORY_SAMPLE_LIMIT,
      expectedContract: expectedContract(
        "WS operator.memory.list",
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
          wsMethod: "operator.worker.ready",
          httpPath: OPERATOR_API.workerReady,
        }),
      fallback: createEmptyWorkerReady,
      authoritative: true,
      sampleLimit: null,
      expectedContract: expectedContract(
        "WS operator.worker.ready",
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
          wsMethod: "operator.worker.tasks.list",
          wsParams: { limit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT },
          httpPath: withQuery(OPERATOR_API.workerTasks, {
            limit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
          }),
        }),
      fallback: createEmptyWorkerTasks,
      authoritative: false,
      sampleLimit: OPERATOR_WORKER_TASK_SAMPLE_LIMIT,
      expectedContract: expectedContract(
        "WS operator.worker.tasks.list",
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
      data: fallbackOperatorControl,
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

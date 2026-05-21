import type { OperatorControlSnapshot } from "../../../domain/index.js";
import { fallbackOperatorControlMemory } from "./snapshot-memory.js";
import { fallbackOperatorControlRegistryDetail } from "./snapshot-registry-detail.js";
import { fallbackOperatorControlSectionStatus } from "./snapshot-section-status.js";
import { fallbackOperatorControlStatus } from "./snapshot-status.js";
import { fallbackOperatorControlTasks } from "./snapshot-tasks.js";
import { fallbackOperatorControlWorkerReady } from "./snapshot-worker-ready.js";
import { fallbackOperatorControlWorkerTasks } from "./snapshot-worker-tasks.js";

export const fallbackOperatorControl: OperatorControlSnapshot = {
  status: fallbackOperatorControlStatus,
  registryDetail: fallbackOperatorControlRegistryDetail,
  tasks: fallbackOperatorControlTasks,
  memory: fallbackOperatorControlMemory,
  workerReady: fallbackOperatorControlWorkerReady,
  workerTasks: fallbackOperatorControlWorkerTasks,
  sectionStatus: fallbackOperatorControlSectionStatus,
};

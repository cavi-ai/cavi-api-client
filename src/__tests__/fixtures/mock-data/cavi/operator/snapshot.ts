import type { OperatorControlSnapshot } from "../../../../../extensions/cavi/domain/index.js";
import { mockOperatorControlMemory } from "./snapshot-memory.js";
import { mockOperatorControlRegistryDetail } from "./snapshot-registry-detail.js";
import { mockOperatorControlSectionStatus } from "./snapshot-section-status.js";
import { mockOperatorControlStatus } from "./snapshot-status.js";
import { mockOperatorControlTasks } from "./snapshot-tasks.js";
import { mockOperatorControlWorkerReady } from "./snapshot-worker-ready.js";
import { mockOperatorControlWorkerTasks } from "./snapshot-worker-tasks.js";

export const mockOperatorControl: OperatorControlSnapshot = {
  status: mockOperatorControlStatus,
  registryDetail: mockOperatorControlRegistryDetail,
  tasks: mockOperatorControlTasks,
  memory: mockOperatorControlMemory,
  workerReady: mockOperatorControlWorkerReady,
  workerTasks: mockOperatorControlWorkerTasks,
  sectionStatus: mockOperatorControlSectionStatus,
};

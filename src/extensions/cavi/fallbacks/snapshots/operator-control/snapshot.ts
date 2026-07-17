import type { OperatorControlSnapshot } from "../../../domain/index.js";
import { fallbackOperatorControlMemory } from "./snapshot-memory.js";
import { fallbackOperatorControlRegistryDetail } from "./snapshot-registry-detail.js";
import { fallbackOperatorControlSectionStatus } from "./snapshot-section-status.js";
import { fallbackOperatorControlStatus } from "./snapshot-status.js";
import { fallbackOperatorControlTasks } from "./snapshot-tasks.js";

export const fallbackOperatorControl: OperatorControlSnapshot = {
  status: fallbackOperatorControlStatus,
  registryDetail: fallbackOperatorControlRegistryDetail,
  tasks: fallbackOperatorControlTasks,
  memory: fallbackOperatorControlMemory,
  sectionStatus: fallbackOperatorControlSectionStatus,
};

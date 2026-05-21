import type { OperatorControlSnapshot } from "../../../../../cavi/domain/index.js";

export const mockOperatorControlSectionStatus: OperatorControlSnapshot["sectionStatus"] =
  {
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
      sampleLimit: 20,
    },
    memory: {
      available: true,
      authoritative: false,
      error: null,
      sampleLimit: 20,
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
      sampleLimit: 20,
    },
  };

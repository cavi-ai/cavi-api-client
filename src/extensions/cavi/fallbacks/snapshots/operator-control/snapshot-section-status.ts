import type { OperatorControlSnapshot } from "../../../domain/index.js";

export const fallbackOperatorControlSectionStatus: OperatorControlSnapshot["sectionStatus"] =
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
  };

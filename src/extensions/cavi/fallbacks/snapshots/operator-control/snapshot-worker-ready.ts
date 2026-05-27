import type { OperatorControlSnapshot } from "../../../domain/index.js";

export const fallbackOperatorControlWorkerReady: OperatorControlSnapshot["workerReady"] =
  {
    status: "ok",
    pending: 2,
    active: 1,
    shuttingDown: false,
    auth: {
      enabled: true,
      scheme: "bearer",
    },
    backend: {
      mode: "filesystem",
      persistenceEnabled: true,
      stateFile: "",
      recoveredTasks: 3,
    },
  };

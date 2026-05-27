import type { OperatorControlSnapshot } from "../../../../../extensions/cavi/domain/index.js";

export const mockOperatorControlWorkerReady: OperatorControlSnapshot["workerReady"] =
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
      stateFile: "/var/lib/agents/2tony/queue-state.json",
      recoveredTasks: 3,
    },
  };

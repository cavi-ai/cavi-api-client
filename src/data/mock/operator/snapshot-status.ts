import type { OperatorControlSnapshot } from "../../../domain/index.js";
import { mockNow as now } from "../shared.js";
import { mockDelegatedTransport, mockLegacyWorkerFleet } from "./transports.js";

export const mockOperatorControlStatus: OperatorControlSnapshot["status"] = {
  primaryOperator: "tonya",
  fallbackOperator: "tony",
  authorityMode: "authoritative-failover",
  taskStorePath: "/state/cavi-control/operator-control-tasks.json",
  registry: {
    agentCount: 22,
    teamCount: 5,
    sourcePath:
      "/workspace/projects/openclaw/src/caviclaw/operator-control/agents.yaml",
    sourceHash: "mock-registry-hash",
    generatedAt: now - 8 * 60_000,
  },
  taskSummary: {
    primaryOperator: "tonya",
    fallbackOperator: "tony",
    tasks: {
      accepted: 1,
      queued: 2,
      started: 1,
      retrying: 0,
      blocked: 1,
      completed: 8,
      "dead-letter": 1,
    },
    totals: {
      total: 14,
      terminal: 9,
      active: 5,
    },
  },
  runtimes: {
    acpBackendId: "acpx",
    acpBackendHealthy: true,
    sharedMemoryAuthority: "qdrant",
  },
  sharedMemory: {
    storePath: "/state/cavi-control/operator-shared-memory.json",
    collections: {
      "service-context": {
        count: 4,
        lastVerifiedAt: now - 4 * 60_000,
        writeMode: "upsert",
      },
      "task-outcomes": {
        count: 17,
        lastVerifiedAt: now - 2 * 60_000,
        writeMode: "append-only",
      },
      "contract-registry": {
        count: 11,
        lastVerifiedAt: now - 19 * 60_000,
        writeMode: "upsert",
      },
      "channel-events": {
        count: 23,
        lastVerifiedAt: now - 1 * 60_000,
        writeMode: "append-only",
      },
    },
  },
  legacyWorkerFleet: mockLegacyWorkerFleet,
  delegatedFirstClassAgents: mockDelegatedTransport,
  worker: mockLegacyWorkerFleet,
  mesh: {
    legacyExecutionFleet: mockLegacyWorkerFleet,
    delegatedFirstClassAgents: mockDelegatedTransport,
    executionFleet: mockLegacyWorkerFleet,
    projectOps: {
      mode: "task-lifecycle",
      configured: true,
      baseUrl: "http://deb.internal:3010",
      eventEndpoint: "http://deb.internal:3010/operator/events",
      authScheme: "bearer",
      authEnv: "CAVI_CONTROL_DEB_SHARED_SECRET",
      authConfigured: true,
    },
    domainOrchestrators: mockDelegatedTransport,
    marketing: mockDelegatedTransport,
    research: mockDelegatedTransport,
  },
};

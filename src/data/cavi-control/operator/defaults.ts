import type { OperatorControlSnapshot } from "../../../domain/index.js";

function createEmptyTaskSummary(): OperatorControlSnapshot["tasks"]["summary"] {
  return {
    accepted: 0,
    queued: 0,
    started: 0,
    retrying: 0,
    blocked: 0,
    completed: 0,
    "dead-letter": 0,
  };
}

export function createEmptyWorkerTransport(): OperatorControlSnapshot["status"]["worker"] {
  return {
    dispatchTransport: "2tony-http",
    role: "legacy-worker-fleet",
    configured: false,
    baseUrl: null,
    receiptTemplate: null,
    authScheme: null,
    authEnv: null,
    authConfigured: false,
  };
}

export function createEmptyDelegatedTransport(): OperatorControlSnapshot["status"]["delegatedFirstClassAgents"] {
  return {
    dispatchTransport: "delegated-http",
    transportAliases: ["angela-http"],
    role: "delegated-first-class-agent-boundary",
    configured: false,
    baseUrl: null,
    authScheme: null,
    authEnv: null,
    authConfigured: false,
    globalDefaultAlias: null,
    servedTeams: [],
    leadAliases: [],
    defaultAliasByTeam: {},
    teamTopology: [],
    legacyTeams: [],
  };
}

export function createEmptyOperatorStatus(): OperatorControlSnapshot["status"] {
  const worker = createEmptyWorkerTransport();
  const delegatedTransport = createEmptyDelegatedTransport();
  return {
    primaryOperator: "tony",
    fallbackOperator: "tonya",
    authorityMode: "authoritative-failover",
    taskStorePath: "n/a",
    registry: {
      agentCount: 0,
      teamCount: 0,
      sourcePath: "n/a",
      sourceHash: "n/a",
      generatedAt: 0,
    },
    taskSummary: {
      primaryOperator: "tony",
      fallbackOperator: "tonya",
      authorityMode: "authoritative-failover",
      tasks: createEmptyTaskSummary(),
      totals: {
        total: 0,
        terminal: 0,
        active: 0,
      },
    },
    runtimes: {
      acpBackendId: null,
      acpBackendHealthy: false,
      sharedMemoryAuthority: "local-json-shim",
    },
    sharedMemory: {
      storePath: "n/a",
      collections: {
        "service-context": {
          count: 0,
          lastVerifiedAt: null,
          writeMode: "append-only",
        },
        "task-outcomes": {
          count: 0,
          lastVerifiedAt: null,
          writeMode: "append-only",
        },
        "contract-registry": {
          count: 0,
          lastVerifiedAt: null,
          writeMode: "append-only",
        },
        "channel-events": {
          count: 0,
          lastVerifiedAt: null,
          writeMode: "append-only",
        },
      },
    },
    legacyWorkerFleet: worker,
    delegatedFirstClassAgents: delegatedTransport,
    worker,
    mesh: {
      legacyExecutionFleet: worker,
      delegatedFirstClassAgents: delegatedTransport,
      executionFleet: worker,
      projectOps: {
        mode: "task-lifecycle",
        configured: false,
        baseUrl: null,
        eventEndpoint: null,
        authScheme: null,
        authEnv: null,
        authConfigured: false,
      },
      domainOrchestrators: delegatedTransport,
      marketing: delegatedTransport,
      research: delegatedTransport,
    },
  };
}

export function createEmptyOperatorRegistry(): OperatorControlSnapshot["registryDetail"] {
  return {
    schema: "OperatorAgentRegistryV2",
    generatedAt: 0,
    sourcePath: "n/a",
    sourceHash: "n/a",
    agentCount: 0,
    teamCount: 0,
    operatorRuntime: {
      transports: {
        delegatedHttp: { globalDefaultAlias: null },
      },
    },
    agents: [],
    teams: [],
    k8sCluster: [],
    identities: [],
    skillOwnership: [],
  };
}

export function createEmptyOperatorTasks(): OperatorControlSnapshot["tasks"] {
  return {
    tasks: [],
    summary: createEmptyTaskSummary(),
  };
}

export function createEmptyOperatorMemory(): OperatorControlSnapshot["memory"] {
  return {
    authority: "local-json-shim",
    storePath: "n/a",
    generatedAt: 0,
    collections: {
      "service-context": {
        count: 0,
        lastVerifiedAt: null,
        writeMode: "append-only",
      },
      "task-outcomes": {
        count: 0,
        lastVerifiedAt: null,
        writeMode: "append-only",
      },
      "contract-registry": {
        count: 0,
        lastVerifiedAt: null,
        writeMode: "append-only",
      },
      "channel-events": {
        count: 0,
        lastVerifiedAt: null,
        writeMode: "append-only",
      },
    },
    records: [],
  };
}

export function createEmptyWorkerReady(): OperatorControlSnapshot["workerReady"] {
  return {
    status: "not-ready",
    pending: 0,
    active: 0,
    shuttingDown: false,
    auth: {
      enabled: false,
      scheme: "none",
    },
    backend: {
      mode: "memory",
      persistenceEnabled: false,
      stateFile: null,
      recoveredTasks: 0,
    },
  };
}

export function createEmptyWorkerTasks(): OperatorControlSnapshot["workerTasks"] {
  return {
    tasks: [],
    stats: {
      pending: 0,
      active: 0,
      shuttingDown: false,
    },
  };
}

export function createEmptyOperatorSectionStatus(): OperatorControlSnapshot["sectionStatus"] {
  return {
    status: {
      available: false,
      authoritative: true,
      error: null,
      sampleLimit: null,
    },
    registryDetail: {
      available: false,
      authoritative: true,
      error: null,
      sampleLimit: null,
    },
    tasks: {
      available: false,
      authoritative: false,
      error: null,
      sampleLimit: 20,
    },
    memory: {
      available: false,
      authoritative: false,
      error: null,
      sampleLimit: 20,
    },
    workerReady: {
      available: false,
      authoritative: true,
      error: null,
      sampleLimit: null,
    },
    workerTasks: {
      available: false,
      authoritative: false,
      error: null,
      sampleLimit: 20,
    },
  };
}

export type OperatorTaskState =
  | "accepted"
  | "queued"
  | "started"
  | "retrying"
  | "blocked"
  | "completed"
  | "dead-letter";

export type OperatorTaskTier = "LITE" | "STANDARD" | "HEAVY";

export type OperatorTaskRecord = {
  envelope: {
    task_id: string;
    parent_task_id?: string | null;
    requester: {
      id: string;
      kind: string;
    };
    target: {
      capability: string;
      team_id?: string | null;
      team_slug?: string | null;
      alias?: string | null;
    };
    objective: string;
    tier: OperatorTaskTier;
    acceptance_criteria: string[];
    timeout_s: number;
  };
  receipt: {
    task_id: string;
    run_id: string;
    state: OperatorTaskState;
    owner?: string | null;
    attempt: number;
    created_at: number;
    updated_at: number;
    queue_latency_ms?: number | null;
    artifacts: string[];
    failure_code?: string | null;
  };
  events: Array<{
    id: string;
    at: number;
    state: OperatorTaskState;
    note?: string | null;
    owner?: string | null;
    failureCode?: string | null;
  }>;
  validation: {
    validation_id: string;
    validator: string;
    result: "passed" | "failed" | "waived" | "pending";
  } | null;
  outcome: {
    outcome: "success" | "partial" | "fail" | "blocked";
    verification_status: "passed" | "failed" | "waived" | "pending";
    rework_needed: boolean;
    recorded_at: number;
  } | null;
};

export type OperatorTaskListSnapshot = {
  tasks: OperatorTaskRecord[];
  summary: Record<OperatorTaskState, number>;
};

export type OperatorWorkerTaskState =
  | "accepted"
  | "queued"
  | "started"
  | "retrying"
  | "completed"
  | "dead-letter";

export type OperatorWorkerTaskRecord = {
  taskId: string;
  runId: string;
  type: string;
  priority: "low" | "normal" | "high";
  state: OperatorWorkerTaskState;
  attempt: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
  callbackUrl?: string;
  summary?: string;
  failureCode?: string;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type OperatorWorkerTaskListSnapshot = {
  tasks: OperatorWorkerTaskRecord[];
  stats: {
    pending: number;
    active: number;
    shuttingDown: boolean;
  };
};

export type OperatorWorkerReadySnapshot = {
  status: "ok" | "not-ready";
  pending: number;
  active: number;
  shuttingDown: boolean;
  auth: {
    enabled: boolean;
    scheme: "bearer" | "none";
  };
  backend: {
    mode: "memory" | "filesystem" | "redis";
    persistenceEnabled: boolean;
    stateFile: string | null;
    recoveredTasks: number;
  };
};

export type OperatorControlSectionKey =
  | "status"
  | "registryDetail"
  | "tasks"
  | "memory"
  | "workerReady"
  | "workerTasks";

export type OperatorControlSectionStatus = {
  available: boolean;
  authoritative: boolean;
  error: string | null;
  sampleLimit: number | null;
};

export type OperatorWorkerTransportSnapshot = {
  dispatchTransport: string;
  role: "legacy-worker-fleet";
  configured: boolean;
  baseUrl: string | null;
  receiptTemplate: string | null;
  authScheme: "bearer" | null;
  authEnv: string | null;
  authConfigured: boolean;
};

export type OperatorDelegatedTransportSnapshot = {
  dispatchTransport: "delegated-http";
  transportAliases: string[];
  role: "delegated-first-class-agent-boundary";
  configured: boolean;
  baseUrl: string | null;
  authScheme: "bearer" | null;
  authEnv: string | null;
  authConfigured: boolean;
  globalDefaultAlias: string | null;
  servedTeams: string[];
  leadAliases: string[];
  defaultAliasByTeam: Record<string, string>;
  teamTopology: Array<{
    teamId: string;
    declaredTransport: string | null;
    resolvedTransport: "delegated-http";
    leadAlias: string | null;
    defaultAlias: string | null;
    dispatchEndpointEnv: string | null;
    dispatchPath: string | null;
    dispatchAuthEnv: string | null;
    resolvedBaseUrl: string | null;
    resolvedEndpoint: string | null;
    authConfigured: boolean;
    /** When resolvedBaseUrl is null: which env vars to set on the gateway (no secret values). */
    urlResolutionHint?: string | null;
  }>;
  legacyTeams: string[];
};

export type OperatorSharedMemoryCollection =
  | "service-context"
  | "task-outcomes"
  | "contract-registry"
  | "channel-events";

export type OperatorMemoryCollectionSummary = {
  count: number;
  lastVerifiedAt: number | null;
  writeMode: "append-only" | "upsert";
};

export type OperatorMemoryRecord = {
  collection: OperatorSharedMemoryCollection;
  recordId: string;
  scopeKey: string;
  summary: string | null;
  content: Record<string, unknown>;
  metadata: {
    source: string;
    writer: string;
    evidence_ref: string;
    verified_at: number;
    ttl_policy?: string;
  };
  promotedAt: number;
};

export type OperatorSharedMemoryAuthority =
  | "qdrant"
  | "vector-memory"
  | "local-json-shim";

export type OperatorSharedMemorySnapshot = {
  authority: OperatorSharedMemoryAuthority;
  storePath: string;
  generatedAt: number;
  collections: Record<
    OperatorSharedMemoryCollection,
    OperatorMemoryCollectionSummary
  >;
  records: OperatorMemoryRecord[];
};

export type OperatorControlStatusSnapshot = {
  primaryOperator: string;
  fallbackOperator: string;
  authorityMode: "authoritative-failover";
  taskStorePath: string;
  registry: {
    agentCount: number;
    teamCount: number;
    sourcePath: string;
    sourceHash: string;
    generatedAt: number;
  };
  taskSummary: {
    primaryOperator: string;
    fallbackOperator: string;
    authorityMode?: "authoritative-failover";
    tasks: Record<OperatorTaskState, number>;
    totals: {
      total: number;
      terminal: number;
      active: number;
    };
  };
  runtimes: {
    acpBackendId: string | null;
    acpBackendHealthy: boolean;
    sharedMemoryAuthority: OperatorSharedMemoryAuthority;
  };
  sharedMemory: {
    storePath: string;
    collections: Record<
      OperatorSharedMemoryCollection,
      OperatorMemoryCollectionSummary
    >;
  };
  legacyWorkerFleet: OperatorWorkerTransportSnapshot;
  delegatedFirstClassAgents: OperatorDelegatedTransportSnapshot;
  worker: OperatorWorkerTransportSnapshot;
  mesh: {
    legacyExecutionFleet: OperatorWorkerTransportSnapshot;
    delegatedFirstClassAgents: OperatorDelegatedTransportSnapshot;
    executionFleet: OperatorWorkerTransportSnapshot;
    projectOps: {
      mode: "task-lifecycle";
      configured: boolean;
      baseUrl: string | null;
      eventEndpoint: string | null;
      authScheme: "bearer" | null;
      authEnv: string | null;
      authConfigured: boolean;
    };
    domainOrchestrators: OperatorDelegatedTransportSnapshot;
    marketing: OperatorDelegatedTransportSnapshot;
    research: OperatorDelegatedTransportSnapshot;
  };
};

export type OperatorWorkflowLaneStatus = "ready" | "degraded" | "unconfigured";

export type OperatorWorkflowLane = {
  teamId: string;
  teamName: string;
  department: string | null;
  /** Deprecated; retained for compatibility while gateway transitions to `department`. */
  teamKind: string | null;
  runtimeIds: string[];
  runtimeName: string | null;
  runtimeRole: string | null;
  leadName: string | null;
  leadRole: string | null;
  transport: string;
  endpoint: string | null;
  authScheme: string | null;
  authEnv: string | null;
  configured: boolean;
  authConfigured: boolean;
  dispatchReady: boolean;
  status: OperatorWorkflowLaneStatus;
  /** Human-readable reason for degraded/unconfigured, or operational note for ready manual/local lanes */
  statusDetail: string | null;
  routingPolicy: string | null;
  tasksTotal: number;
  tasksCompleted: number;
  tasksBlocked: number;
  tasksFailed: number;
  tasksDeadLetter: number;
  tasksTimeout: number;
  successRate: number;
  failureRate: number;
  avgTimeToCompleteMs: number | null;
  runsTotal: number;
  totalTokens: number;
  totalCostUsd: number;
  primaryModel?: string;
  lastActivityAt: number | null;
  queue: {
    pending: number;
    active: number;
    recovered: number;
    backendMode: "memory" | "filesystem" | "redis";
  } | null;
};

export type OperatorRegistryAgentIdentity = {
  theme: string | null;
  avatar: string | null;
  rosterImage: string | null;
  cardImage: string | null;
  alt: string | null;
};

export type OperatorRegistryAgentOwnership = {
  parentOrchestrator: string | null;
  ownsDomains: string[];
  delegatesTo: string[];
  ownsOutputs: string[];
  runtimeSpecialists: string[];
};

export type OperatorRegistryAgentRoleBoundary = {
  allowed: string[];
  forbidden: string[];
  enforcement: string | null;
};

export type OperatorRegistryAgentRepoConfig = {
  mode: "auto" | "manual" | "all";
  include: string[];
  exclude: string[];
  patterns: string[];
};

export type OperatorRegistryAgent = {
  id: string;
  name: string;
  role: string | null;
  specialty: string | null;
  model: string | null;
  skill: string | null;
  spawnTemplate: string | null;
  repos: string[];
  repoConfig: OperatorRegistryAgentRepoConfig | null;
  triggers: string[];
  notes: string | null;
  teams: string[];
  maxConcurrentSessions: number;
  capabilities: string[];
  mcpAccess: string[];
  reviewHandles: string[];
  executionMode: string | null;
  identity: OperatorRegistryAgentIdentity | null;
  ownership: OperatorRegistryAgentOwnership | null;
  roleBoundary: OperatorRegistryAgentRoleBoundary | null;
  tokenEnv: string | null;
  boardUrl: string | null;
  k8sService: string | null;
  delegatesTo: string[];
};

export type OperatorRegistryRuntime = {
  id: string;
  name: string | null;
  role: string | null;
  namespace: string | null;
  status: string | null;
  triggers: string[];
  maxConcurrentSessions: number;
  port: number | null;
  replicas: number | null;
  endpoints: string[];
  discordBotId: string | null;
};

export type OperatorRegistryIdentity = {
  id: string;
  kind: "agent" | "runtime";
  name: string;
  role: string | null;
  capabilities: string[];
  teamIds: string[];
  leadTeamIds: string[];
  maxConcurrentSessions: number;
};

export type OperatorRegistryTeam = {
  id: string;
  name: string;
  teamSlug: string;
  teamCode: string;
  sectorSlug: string;
  sectorCode: string;
  portalId: string | null;
  displayName: string;
  legacyAliases: string[];
  department: string | null;
  /** Deprecated; retained for compatibility while gateway transitions to `department`. */
  kind: string | null;
  parentTeamId: string | null;
  lead: string | null;
  leadKind: "agent" | "runtime" | "external" | null;
  routeViaLead: boolean;
  mission: string | null;
  members: string[];
  runtimeIds: string[];
  memberIdentityIds: string[];
  ownsCapabilities: string[];
  maxParallel: number | null;
  dispatchTransport: string | null;
  dispatchEndpointEnv: string | null;
  dispatchPath: string | null;
  dispatchAuthScheme: string | null;
  dispatchAuthEnv: string | null;
  dispatchDefaultAlias: string | null;
  routingPolicy: string | null;
  notes: string | null;
  ancestorTeamIds: string[];
  descendantTeamIds: string[];
  teamManifest: string | null;
  headOwnedAliases: string[];
  runtimeMembers: string[];
};

export type OperatorRegistrySkillOwnership = {
  skill: string;
  owner: string;
  status: string | null;
};

export type OperatorRegistryDelegatedTransportConfig = {
  globalDefaultAlias: string | null;
};

export type OperatorRegistryRuntimeConfig = {
  transports: {
    delegatedHttp: OperatorRegistryDelegatedTransportConfig;
  };
};

export type OperatorRegistrySnapshot = {
  schema: "OperatorAgentRegistryV1" | "OperatorAgentRegistryV2";
  generatedAt: number;
  sourcePath: string;
  sourceHash: string;
  agentCount: number;
  teamCount: number;
  operatorRuntime: OperatorRegistryRuntimeConfig;
  agents: OperatorRegistryAgent[];
  teams: OperatorRegistryTeam[];
  k8sCluster: OperatorRegistryRuntime[];
  identities: OperatorRegistryIdentity[];
  skillOwnership: OperatorRegistrySkillOwnership[];
};

export type OperatorControlSnapshot = {
  status: OperatorControlStatusSnapshot;
  registryDetail: OperatorRegistrySnapshot;
  tasks: OperatorTaskListSnapshot;
  memory: OperatorSharedMemorySnapshot;
  workerReady: OperatorWorkerReadySnapshot;
  workerTasks: OperatorWorkerTaskListSnapshot;
  sectionStatus: Record<
    OperatorControlSectionKey,
    OperatorControlSectionStatus
  >;
};

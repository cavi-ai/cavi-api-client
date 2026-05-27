import type {
  OperatorRegistryAgent,
  OperatorRegistryRuntime,
  OperatorRegistryTeam,
} from "../../../domain/index.js";

/** Default values for new agent fields — spread into each mock agent. */
export const agentDefaults: Pick<
  OperatorRegistryAgent,
  | "repoConfig"
  | "capabilities"
  | "mcpAccess"
  | "reviewHandles"
  | "executionMode"
  | "identity"
  | "ownership"
  | "roleBoundary"
  | "tokenEnv"
  | "boardUrl"
  | "k8sService"
  | "delegatesTo"
> = {
  repoConfig: null,
  capabilities: [],
  mcpAccess: [],
  reviewHandles: [],
  executionMode: null,
  identity: null,
  ownership: null,
  roleBoundary: null,
  tokenEnv: null,
  boardUrl: null,
  k8sService: null,
  delegatesTo: [],
};

/** Default values for new team fields. */
export const teamDefaults: Pick<
  OperatorRegistryTeam,
  "department" | "teamManifest" | "headOwnedAliases" | "runtimeMembers"
> = {
  department: null,
  teamManifest: null,
  headOwnedAliases: [],
  runtimeMembers: [],
};

/** Default values for new k8s fields. */
export const k8sDefaults: Pick<
  OperatorRegistryRuntime,
  "port" | "replicas" | "endpoints" | "discordBotId"
> = {
  port: null,
  replicas: null,
  endpoints: [],
  discordBotId: null,
};

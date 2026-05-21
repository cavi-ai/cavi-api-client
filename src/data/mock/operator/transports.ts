import type { OperatorControlSnapshot } from "../../../domain/index.js";

export const mockLegacyWorkerFleet: OperatorControlSnapshot["status"]["legacyWorkerFleet"] =
  {
    dispatchTransport: "2tony-http",
    role: "legacy-worker-fleet",
    configured: true,
    baseUrl: "http://2tony.internal:3009",
    receiptTemplate:
      "http://gateway.internal/cavi-control/api/tasks/{taskId}/receipts",
    authScheme: "bearer",
    authEnv: "CAVI_CONTROL_2TONY_SHARED_SECRET",
    authConfigured: true,
  };

export const mockDelegatedTransport: OperatorControlSnapshot["status"]["delegatedFirstClassAgents"] =
  {
    dispatchTransport: "delegated-http",
    transportAliases: ["angela-http", "scout-http"],
    role: "delegated-first-class-agent-boundary",
    configured: true,
    baseUrl: "http://angela.internal:18789",
    authScheme: "bearer",
    authEnv: "CAVI_CONTROL_ANGELA_SHARED_SECRET",
    authConfigured: true,
    globalDefaultAlias: "tonys-angels",
    servedTeams: ["marketing", "research"],
    leadAliases: ["tonys-angels", "scout"],
    defaultAliasByTeam: {
      marketing: "tonys-angels",
      research: "scout",
    },
    teamTopology: [
      {
        teamId: "marketing",
        declaredTransport: "angela-http",
        resolvedTransport: "delegated-http",
        leadAlias: "tonys-angels",
        defaultAlias: "tonys-angels",
        dispatchEndpointEnv: "CAVI_CONTROL_ANGELA_URL",
        dispatchPath: "/api/message",
        dispatchAuthEnv: "CAVI_CONTROL_ANGELA_SHARED_SECRET",
        resolvedBaseUrl: "http://angela.internal:18789",
        resolvedEndpoint: "http://angela.internal:18789/api/message",
        authConfigured: true,
        urlResolutionHint: null,
      },
      {
        teamId: "research",
        declaredTransport: "delegated-http",
        resolvedTransport: "delegated-http",
        leadAlias: "scout",
        defaultAlias: "scout",
        dispatchEndpointEnv: "CAVI_CONTROL_INTERNAL_CONTROL_URL",
        dispatchPath: "/api/message",
        dispatchAuthEnv: "CAVI_CONTROL_INTERNAL_CONTROL_SHARED_SECRET",
        resolvedBaseUrl: "http://gateway.internal",
        resolvedEndpoint: "http://gateway.internal/api/message",
        authConfigured: true,
        urlResolutionHint: null,
      },
    ],
    legacyTeams: ["execution-fleet"],
  };

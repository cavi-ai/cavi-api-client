import type { OperatorControlSnapshot } from "../../../domain/index.js";
import { OPERATOR_DISPATCH_ENDPOINTS } from "../../../paths.js";

const TWO_TONY_INTERNAL_BASE_URL = "http://2tony.internal:3009";
const ANGELA_INTERNAL_BASE_URL = "http://angela.internal:18789";
const GATEWAY_INTERNAL_BASE_URL = "http://gateway.internal";

function mockEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

export const mockLegacyWorkerFleet: OperatorControlSnapshot["status"]["legacyWorkerFleet"] =
  {
    dispatchTransport: "2tony-http",
    role: "legacy-worker-fleet",
    configured: true,
    baseUrl: TWO_TONY_INTERNAL_BASE_URL,
    receiptTemplate: mockEndpoint(
      GATEWAY_INTERNAL_BASE_URL,
      OPERATOR_DISPATCH_ENDPOINTS.taskReceiptsTemplate,
    ),
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
    baseUrl: ANGELA_INTERNAL_BASE_URL,
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
        dispatchPath: OPERATOR_DISPATCH_ENDPOINTS.message,
        dispatchAuthEnv: "CAVI_CONTROL_ANGELA_SHARED_SECRET",
        resolvedBaseUrl: ANGELA_INTERNAL_BASE_URL,
        resolvedEndpoint: mockEndpoint(
          ANGELA_INTERNAL_BASE_URL,
          OPERATOR_DISPATCH_ENDPOINTS.message,
        ),
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
        dispatchPath: OPERATOR_DISPATCH_ENDPOINTS.message,
        dispatchAuthEnv: "CAVI_CONTROL_INTERNAL_CONTROL_SHARED_SECRET",
        resolvedBaseUrl: GATEWAY_INTERNAL_BASE_URL,
        resolvedEndpoint: mockEndpoint(
          GATEWAY_INTERNAL_BASE_URL,
          OPERATOR_DISPATCH_ENDPOINTS.message,
        ),
        authConfigured: true,
        urlResolutionHint: null,
      },
    ],
    legacyTeams: ["execution-fleet"],
  };

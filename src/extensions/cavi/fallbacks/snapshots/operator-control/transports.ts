import type { OperatorControlSnapshot } from "../../../domain/index.js";
import { OPERATOR_DISPATCH_ENDPOINTS } from "../../../contracts/paths.js";

const SECONDARY_OPERATOR_INTERNAL_BASE_URL: string | null = null;
const SERVICE_OPERATOR_INTERNAL_BASE_URL: string | null = null;
const GATEWAY_INTERNAL_BASE_URL: string | null = null;

function fallbackEndpoint(baseUrl: string | null, path: string): string | null {
  if (!baseUrl) return null;
  return `${baseUrl}${path}`;
}

export const fallbackLegacyWorkerFleet: OperatorControlSnapshot["status"]["legacyWorkerFleet"] =
  {
    dispatchTransport: "primary-operator-2-http",
    role: "legacy-worker-fleet",
    configured: false,
    baseUrl: SECONDARY_OPERATOR_INTERNAL_BASE_URL,
    receiptTemplate: fallbackEndpoint(
      GATEWAY_INTERNAL_BASE_URL,
      OPERATOR_DISPATCH_ENDPOINTS.taskReceiptsTemplate,
    ),
    authScheme: "bearer",
    authEnv: "CAVI_CONTROL_SECONDARY_OPERATOR_SHARED_SECRET",
    authConfigured: false,
  };

export const fallbackDelegatedTransport: OperatorControlSnapshot["status"]["delegatedFirstClassAgents"] =
  {
    dispatchTransport: "delegated-http",
    transportAliases: ["service-operator-http", "research-operator-http"],
    role: "delegated-first-class-agent-boundary",
    configured: false,
    baseUrl: SERVICE_OPERATOR_INTERNAL_BASE_URL,
    authScheme: "bearer",
    authEnv: "CAVI_CONTROL_SERVICE_OPERATOR_SHARED_SECRET",
    authConfigured: false,
    globalDefaultAlias: "operator-team",
    servedTeams: ["marketing", "research"],
    leadAliases: ["operator-team", "research-operator"],
    defaultAliasByTeam: {
      marketing: "operator-team",
      research: "research-operator",
    },
    teamTopology: [
      {
        teamId: "marketing",
        declaredTransport: "service-operator-http",
        resolvedTransport: "delegated-http",
        leadAlias: "operator-team",
        defaultAlias: "operator-team",
        dispatchEndpointEnv: "CAVI_CONTROL_SERVICE_OPERATOR_URL",
        dispatchPath: OPERATOR_DISPATCH_ENDPOINTS.message,
        dispatchAuthEnv: "CAVI_CONTROL_SERVICE_OPERATOR_SHARED_SECRET",
        resolvedBaseUrl: SERVICE_OPERATOR_INTERNAL_BASE_URL,
        resolvedEndpoint: fallbackEndpoint(
          SERVICE_OPERATOR_INTERNAL_BASE_URL,
          OPERATOR_DISPATCH_ENDPOINTS.message,
        ),
        authConfigured: false,
        urlResolutionHint: "Set CAVI_CONTROL_SERVICE_OPERATOR_URL at runtime.",
      },
      {
        teamId: "research",
        declaredTransport: "delegated-http",
        resolvedTransport: "delegated-http",
        leadAlias: "research-operator",
        defaultAlias: "research-operator",
        dispatchEndpointEnv: "CAVI_CONTROL_INTERNAL_CONTROL_URL",
        dispatchPath: OPERATOR_DISPATCH_ENDPOINTS.message,
        dispatchAuthEnv: "CAVI_CONTROL_INTERNAL_CONTROL_SHARED_SECRET",
        resolvedBaseUrl: GATEWAY_INTERNAL_BASE_URL,
        resolvedEndpoint: fallbackEndpoint(
          GATEWAY_INTERNAL_BASE_URL,
          OPERATOR_DISPATCH_ENDPOINTS.message,
        ),
        authConfigured: false,
        urlResolutionHint: "Set CAVI_CONTROL_INTERNAL_CONTROL_URL at runtime.",
      },
    ],
    legacyTeams: ["execution-fleet"],
  };

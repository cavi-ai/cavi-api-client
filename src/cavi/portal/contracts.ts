import { requirePortalClientId } from "./client-id.js";

export const PORTAL_MEMORY_SNAPSHOT_CONTRACT = "PORTAL_MEMORY_SNAPSHOT_V1" as const;

export type PortalLibraryRef = {
  scope: "team" | "fleet";
  libraryTeamId: string;
  ownerPortalId?: string;
};

export type PortalApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type PortalApiEnvelopeBase = {
  clientId: string;
  portalId: string;
  teamSlug: string;
  memberId?: string;
  feature: string;
  library?: PortalLibraryRef;
};

export type PortalApiRequestEnvelope<TContract extends string, TPayload> = PortalApiEnvelopeBase & {
  contract: TContract;
  requestedAt: number;
  payload: TPayload;
};

export type PortalApiResponseEnvelope<TContract extends string, TData> = PortalApiEnvelopeBase & {
  contract: TContract;
  generatedAt: number;
  ok: boolean;
  data: TData;
  error?: PortalApiError;
};

export type PortalMemoryEnvelope<TSchemaContract extends string, TPayload> = {
  contract: typeof PORTAL_MEMORY_SNAPSHOT_CONTRACT;
  clientId: string;
  teamSlug: string;
  memberId: string;
  memoryKey: string;
  schemaContract: TSchemaContract;
  updatedAt: number;
  payload: TPayload;
  portalId?: string;
  feature?: string;
  library?: PortalLibraryRef;
};

export function buildPortalApiRequestEnvelope<TContract extends string, TPayload>(
  params: PortalApiEnvelopeBase & {
    contract: TContract;
    payload: TPayload;
    requestedAt?: number;
  },
): PortalApiRequestEnvelope<TContract, TPayload> {
  return {
    contract: params.contract,
    clientId: params.clientId,
    portalId: params.portalId,
    teamSlug: params.teamSlug,
    ...(params.memberId ? { memberId: params.memberId } : {}),
    feature: params.feature,
    ...(params.library ? { library: params.library } : {}),
    requestedAt: params.requestedAt ?? Date.now(),
    payload: params.payload,
  };
}

export function buildPortalApiSuccessEnvelope<TContract extends string, TData>(
  params: PortalApiEnvelopeBase & {
    contract: TContract;
    data: TData;
    generatedAt?: number;
  },
): PortalApiResponseEnvelope<TContract, TData> {
  return {
    contract: params.contract,
    clientId: params.clientId,
    portalId: params.portalId,
    teamSlug: params.teamSlug,
    ...(params.memberId ? { memberId: params.memberId } : {}),
    feature: params.feature,
    ...(params.library ? { library: params.library } : {}),
    generatedAt: params.generatedAt ?? Date.now(),
    ok: true,
    data: params.data,
  };
}

export function buildPortalApiErrorEnvelope<TContract extends string, TData>(
  params: PortalApiEnvelopeBase & {
    contract: TContract;
    data: TData;
    error: PortalApiError;
    generatedAt?: number;
  },
): PortalApiResponseEnvelope<TContract, TData> {
  return {
    contract: params.contract,
    clientId: params.clientId,
    portalId: params.portalId,
    teamSlug: params.teamSlug,
    ...(params.memberId ? { memberId: params.memberId } : {}),
    feature: params.feature,
    ...(params.library ? { library: params.library } : {}),
    generatedAt: params.generatedAt ?? Date.now(),
    ok: false,
    data: params.data,
    error: params.error,
  };
}

export function buildPortalMemoryEnvelope<TSchemaContract extends string, TPayload>(
  params: {
    clientId: string;
    teamSlug: string;
    memberId: string;
    memoryKey: string;
    schemaContract: TSchemaContract;
    payload: TPayload;
    updatedAt?: number;
    portalId?: string;
    feature?: string;
    library?: PortalLibraryRef;
  },
): PortalMemoryEnvelope<TSchemaContract, TPayload> {
  const clientId = requirePortalClientId(params.clientId);
  return {
    contract: PORTAL_MEMORY_SNAPSHOT_CONTRACT,
    clientId,
    teamSlug: params.teamSlug,
    memberId: params.memberId,
    memoryKey: params.memoryKey,
    schemaContract: params.schemaContract,
    updatedAt: params.updatedAt ?? Date.now(),
    payload: params.payload,
    ...(params.portalId ? { portalId: params.portalId } : {}),
    ...(params.feature ? { feature: params.feature } : {}),
    ...(params.library ? { library: params.library } : {}),
  };
}
export { PORTAL_CLIENT_ID_HEADER } from "./client-id.js";

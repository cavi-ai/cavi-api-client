export type DataSourceMode = "gateway" | "mock";

export type ContractGapReason =
  | "backend-unavailable"
  | "backend-not-configured"
  | "endpoint-not-found"
  | "auth-insufficient"
  | "transport-disconnected"
  | "unknown";

export type ContractGap = {
  area: string;
  expectedContract: string;
  note: string;
  reason?: ContractGapReason;
  httpStatus?: number;
};

export type DataEnvelope<TData> = {
  data: TData;
  source: DataSourceMode;
  fetchedAt: number;
  contractGaps: ContractGap[];
};

export type ConnectivityStatus =
  | "live"
  | "empty-but-valid"
  | "mock-fallback"
  | "conditional-unavailable"
  | "not-loaded";

export type ConnectivityDomain = {
  domain: string;
  label: string;
  transport: "ws" | "http" | "mixed";
  source: DataSourceMode | "not-loaded";
  status: ConnectivityStatus;
  contractGaps: readonly ContractGap[];
  fetchedAt: number | null;
};

export type MutationResult<TData> = {
  data: TData;
  source: DataSourceMode;
  appliedAt: number;
  contractGaps: ContractGap[];
};

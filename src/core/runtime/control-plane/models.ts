import type { RuntimeControlPlaneMetadata, RuntimePage } from "./types.js";

export interface RuntimeModelDescriptor {
  providerId: string;
  id: string;
  displayName?: string;
  availability: "available" | "unavailable" | "unknown";
  capabilities?: Readonly<Record<string, boolean>>;
  authenticated?: boolean;
  metadata: RuntimeControlPlaneMetadata;
}

export interface RuntimeAuthStatus {
  providerId: string;
  profileId?: string;
  status: "authenticated" | "unauthenticated" | "expired" | "unknown";
  expiresAt?: string;
  sourceCategory?: string;
  reasonCode?: string;
  metadata: RuntimeControlPlaneMetadata;
}

export interface ModelCatalogClient {
  listModels(query?: { cursor?: string; limit?: number }): Promise<RuntimePage<RuntimeModelDescriptor>>;
}

export interface AuthStatusClient {
  listAuthStatus(): Promise<readonly RuntimeAuthStatus[]>;
}

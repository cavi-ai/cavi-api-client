import type { RuntimeControlPlaneMetadata } from "./types.js";

export interface RuntimeWorkspaceDescriptor {
  id: string;
  providerId: string;
  displayName?: string;
  root?: string;
  accessMode: "read-only" | "read-write" | "unknown";
  metadata: RuntimeControlPlaneMetadata;
}

export interface WorkspaceClient {
  listWorkspaces(): Promise<readonly RuntimeWorkspaceDescriptor[]>;
  getWorkspace(id: string): Promise<RuntimeWorkspaceDescriptor>;
}

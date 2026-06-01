import { ApiClientError, ApiClientErrorCode } from "../errors.js";
import type { RuntimeCapabilities, RuntimeSurface } from "./capabilities.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "./run.js";

export type { RuntimeCapabilities, RuntimeSurface } from "./capabilities.js";
export type {
  RuntimeRunStartBody,
  RuntimeRunStatus,
  RuntimeRunMessage,
  RuntimeRunInput,
  RuntimeRunState,
} from "./run.js";

/**
 * The UNIVERSAL agent-runtime contract every provider implements.
 * Gateway-only surfaces (teams/kanban/workspace/operator) live on
 * `GatewayClient`, which extends this.
 */
export interface RuntimeClient {
  getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
  startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
  getRun(runId: string): Promise<RuntimeRunStatus>;
  /** Capability-gated; providers without cancel throw via `unsupportedRuntimeSurface`. */
  cancelRun(runId: string): Promise<{ status: string }>;
}

/** Throw a typed EndpointNotFound for a surface this provider does not serve. */
export function unsupportedRuntimeSurface(
  providerKind: string,
  surface: RuntimeSurface,
): never {
  throw new ApiClientError(
    `Provider "${providerKind}" does not support the "${surface}" surface`,
    { code: ApiClientErrorCode.EndpointNotFound },
  );
}

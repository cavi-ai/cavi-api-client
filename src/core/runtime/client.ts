import { ApiClientError, ApiClientErrorCode } from "../errors.js";
import type { RuntimeCapabilities, RuntimeSurface } from "./capabilities.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "./run.js";
import type { RunEventStreamHandlers } from "./run-stream.js";
import type {
  RuntimeBatchRequest,
  RuntimeBatchStatus,
  RuntimeBatchResult,
} from "./batch.js";

export type { RuntimeCapabilities, RuntimeSurface } from "./capabilities.js";
export type {
  RuntimeRunStartBody,
  RuntimeRunStatus,
  RuntimeRunMessage,
  RuntimeRunInput,
  RuntimeRunState,
} from "./run.js";
export type {
  RuntimeBatchRequest,
  RuntimeBatchStatus,
  RuntimeBatchResult,
  RuntimeBatchCounts,
  RuntimeBatchState,
  RuntimeBatchOutcome,
} from "./batch.js";

/**
 * The UNIVERSAL agent-runtime contract every provider implements.
 * Gateway-only surfaces (teams/kanban/workspace/operator) live on
 * `GatewayClient`, which extends this.
 */
export interface RuntimeClient {
  getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
  startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
  /**
   * Optional — synchronous/stateless providers (e.g. Claude SDK) omit these.
   * Consumers should null-check (`client.cancelRun?.(id)`) or gate on
   * `RuntimeCapabilities`. Providers that expose the method but can't serve it
   * should throw `ApiClientError(EndpointNotFound)`.
   */
  getRun?(runId: string): Promise<RuntimeRunStatus>;
  cancelRun?(runId: string): Promise<{ status: string }>;
  /**
   * Start a run and stream it as canonical RunStreamEvents. Optional: providers
   * that use a subscribe-by-runId model (gateways) omit this and expose a
   * RunEventStreamProvider instead.
   */
  streamRun?(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  /**
   * Batch surface (optional). Providers that support async batch processing
   * declare `supports.batch` and implement these; others omit them. Consumers
   * null-check (`client.submitBatch?.(…)`) or gate on `RuntimeCapabilities`.
   */
  submitBatch?(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus>;
  getBatch?(batchId: string): Promise<RuntimeBatchStatus>;
  cancelBatch?(batchId: string): Promise<RuntimeBatchStatus>;
  /**
   * Retrieve batch results. Throws an `EndpointNotFound`-class error if the
   * batch has not ended yet — poll `getBatch` until `resultsAvailable` is true.
   */
  getBatchResults?(batchId: string): Promise<RuntimeBatchResult[]>;
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

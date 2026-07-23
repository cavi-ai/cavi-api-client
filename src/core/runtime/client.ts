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
 * Gateway backends implement this via `GatewayApiClient` (teams/kanban/
 * workspace/operator live there). React’s `GatewayClient*` names are the
 * WebSocket RPC context only — there is no exported `GatewayClient` interface.
 */
export interface RuntimeClient {
  getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
  startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
  /**
   * Optional run lifecycle. Three real behaviors exist in this package:
   *
   * - **omit** — method absent; consumers null-check (`client.getRun?.(id)`).
   * - **server** — real backend retrieval/cancel (Codex background responses,
   *   Claude Managed Agents sessions, `GatewayApiClient` HTTP runs).
   * - **sync-store** — synchronous providers (Claude Messages, Gemini) keep a
   *   local `SynchronousRunStore` of terminal statuses from `startRun`;
   *   `getRun` returns the remembered status or an honest `unknown` status for
   *   foreign ids and **does not throw**. `cancelRun` is a no-op success on
   *   an already-terminal run.
   *
   * Providers that expose the method but cannot serve it any other way should
   * throw `ApiClientError(EndpointNotFound)` (`unsupported-throw` semantics).
   */
  getRun?(runId: string): Promise<RuntimeRunStatus>;
  cancelRun?(runId: string): Promise<{ status: string }>;
  /**
   * Start a run and stream it as canonical RunStreamEvents. Optional.
   *
   * **Streaming duality (intentional):** runtime-only providers implement
   * `streamRun(body, handlers)`. Gateway providers typically omit this and
   * expose subscribe-by-`runId` via `createSseRunEventProvider` /
   * `RunEventStreamProvider` on the gateway provider module instead.
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

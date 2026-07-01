import type { RuntimeRunStartBody, RuntimeRunStatus } from "./run.js";

/** One entry in a batch submission — a run body plus a caller correlation id. */
export type RuntimeBatchRequest = {
  /** Caller-chosen id, echoed on the matching result. */
  customId: string;
  body: RuntimeRunStartBody;
};

export type RuntimeBatchState =
  | "in_progress"
  | "canceling"
  | "completed"
  | "cancelled"
  | "failed"
  | (string & {});

export type RuntimeBatchCounts = {
  total?: number;
  processing?: number;
  succeeded?: number;
  errored?: number;
  canceled?: number;
  expired?: number;
};

export type RuntimeBatchStatus = {
  batch_id: string;
  status: RuntimeBatchState;
  counts?: RuntimeBatchCounts;
  createdAt?: number | string;
  endedAt?: number | string;
  /** True once results are retrievable (the provider batch has ended). */
  resultsAvailable?: boolean;
};

export type RuntimeBatchOutcome =
  | "succeeded"
  | "errored"
  | "canceled"
  | "expired"
  | (string & {});

export type RuntimeBatchResult = {
  customId: string;
  outcome: RuntimeBatchOutcome;
  /** Present when outcome === "succeeded": the normalized run status (incl. tokens). */
  run?: RuntimeRunStatus;
  error?: string;
};

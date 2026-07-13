export interface RuntimeCapabilities {
  streaming: boolean;
}

export interface RuntimeRunStartBody {
  prompt: string;
}

export type RuntimeRunStatus = "queued" | "running" | "complete" | "failed";

export interface RunStreamEvent {
  type: string;
}

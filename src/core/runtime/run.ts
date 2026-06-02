/** A single conversation message. Structurally shared by every provider. */
export type RuntimeRunMessage = {
  role: string;
  content: string | Record<string, unknown>[];
  [key: string]: unknown;
};

export type RuntimeRunInput = string | RuntimeRunMessage[];

/**
 * The UNIVERSAL run-start body. Carries only fields every agent runtime
 * understands. Provider/gateway-only concepts (sessions, routing, target
 * profiles, tasks) are NOT here — they live on `GatewayRunStartBody`.
 */
export type RuntimeRunStartBody = {
  input: RuntimeRunInput;
  /** System / developer instructions (Anthropic `system`). */
  instructions?: string;
  model?: string;
  tools?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
};

export type RuntimeRunState =
  | "started"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "stopping"
  | (string & {});

/** The UNIVERSAL run status. Gateway-only fields live on `GatewayRunStatus`. */
export type RuntimeRunStatus = {
  run_id: string;
  status: RuntimeRunState;
  model?: string;
  output?: string;
  response?: string;
  error?: string;
  usage?: Record<string, number>;
};

export function isRuntimeRunStartBody(value: unknown): value is RuntimeRunStartBody {
  if (typeof value !== "object" || value === null) return false;
  const input = (value as { input?: unknown }).input;
  return typeof input === "string" || Array.isArray(input);
}

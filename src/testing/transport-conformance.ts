import type { TransportKind } from "../core/transport/index.js";

export type TransportConformanceIssue = Readonly<{
  code:
    | "abort_leak"
    | "unbounded_retry"
    | "mutation_replayed"
    | "secret_exposed"
    | "resource_leak"
    | "protocol_mismatch";
  message: string;
}>;

export type TransportConformanceReport = Readonly<{
  ok: boolean;
  kind: TransportKind;
  issues: readonly TransportConformanceIssue[];
}>;

export type TransportConformanceObservation = Readonly<{
  attempts: number;
  mutationSendCount: number;
  serializedErrors: readonly string[];
  serializedEvents: readonly string[];
  openResources: number;
  protocolViolations: readonly string[];
  /** The configured attempt ceiling, when retry behavior is exercised. */
  maxAttempts?: number;
  /** Events, callbacks, or writes observed after abort completed. */
  emissionsAfterAbort?: number;
}>;

type FixtureFor<K extends TransportKind> = Readonly<{
  kind: K;
  run(): Promise<TransportConformanceObservation>;
}>;

export type HttpTransportConformanceFixture = FixtureFor<"http">;
export type SseTransportConformanceFixture = FixtureFor<"sse">;
export type WebSocketTransportConformanceFixture = FixtureFor<"websocket">;
export type JsonRpcTransportConformanceFixture = FixtureFor<"json-rpc">;
export type StdioTransportConformanceFixture = FixtureFor<"stdio">;
export type UnixTransportConformanceFixture = FixtureFor<"unix">;

export type TransportConformanceFixture =
  | HttpTransportConformanceFixture
  | SseTransportConformanceFixture
  | WebSocketTransportConformanceFixture
  | JsonRpcTransportConformanceFixture
  | StdioTransportConformanceFixture
  | UnixTransportConformanceFixture;

const exposedSecretPatterns = [
  /\bBearer\s+(?!\[REDACTED\]\b)[A-Za-z0-9._~+/=-]+/iu,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*(?!["']?\[REDACTED\])[^\s,;}]+/iu,
] as const;

function exposesSecret(serialized: string): boolean {
  return exposedSecretPatterns.some((pattern) => pattern.test(serialized));
}

export async function inspectTransportConformance(
  fixture: TransportConformanceFixture,
): Promise<TransportConformanceReport> {
  const observation = await fixture.run();
  const issues: TransportConformanceIssue[] = [];

  if ((observation.emissionsAfterAbort ?? 0) > 0) {
    issues.push({
      code: "abort_leak",
      message: "The transport emitted work after abort completed.",
    });
  }
  if (
    observation.maxAttempts !== undefined &&
    observation.attempts > observation.maxAttempts
  ) {
    issues.push({
      code: "unbounded_retry",
      message: `The transport made ${observation.attempts} attempts with a limit of ${observation.maxAttempts}.`,
    });
  }
  if (observation.mutationSendCount > 1) {
    issues.push({
      code: "mutation_replayed",
      message: `The transport sent a mutation ${observation.mutationSendCount} times.`,
    });
  }
  if ([...observation.serializedErrors, ...observation.serializedEvents].some(exposesSecret)) {
    issues.push({
      code: "secret_exposed",
      message: "A serialized transport error or event exposed authentication material.",
    });
  }
  if (observation.openResources > 0) {
    issues.push({
      code: "resource_leak",
      message: `The transport left ${observation.openResources} resource(s) open.`,
    });
  }
  for (const violation of observation.protocolViolations) {
    issues.push({ code: "protocol_mismatch", message: violation });
  }

  return { ok: issues.length === 0, kind: fixture.kind, issues };
}

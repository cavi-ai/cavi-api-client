import type { TransportKind } from "../core/transport/index.js";
import { contentLengthCodec, jsonLinesCodec } from "../core/transport/index.js";

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

export type TransportConformanceSharedObservation = Readonly<{
  maxAttempts: number;
  emissionsAfterAbort: number;
  serializedErrors: readonly string[];
  serializedEvents: readonly string[];
  openResources: number;
}>;

type HttpRequestObservation = Readonly<{
  operationId: string;
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  attempt: number;
  status?: number;
  idempotencyEligible: boolean;
  idempotencyKey?: string;
}>;
export type HttpTransportConformanceObservation = TransportConformanceSharedObservation & Readonly<{
  kind: "http";
  requests: readonly HttpRequestObservation[];
}>;

type SseConnectionObservation = Readonly<{
  attempt: number;
  requestedCursor?: string;
  acceptedLastEventId?: string;
}>;
export type SseTransportConformanceObservation = TransportConformanceSharedObservation & Readonly<{
  kind: "sse";
  connections: readonly SseConnectionObservation[];
  deliveredIds: readonly string[];
}>;

type WebSocketFrameObservation = Readonly<{
  sequence: number;
  messageId?: string;
}>;
type WebSocketLifecycleObservation =
  | Readonly<{ state: "opened"; generation: number }>
  | Readonly<{ state: "closed"; generation: number }>
  | Readonly<{
    state: "sent" | "delivered";
    generation: number;
    frame: WebSocketFrameObservation;
  }>;
export type WebSocketTransportConformanceObservation =
  TransportConformanceSharedObservation & Readonly<{
    kind: "websocket";
    lifecycle: readonly WebSocketLifecycleObservation[];
  }>;

type JsonRpcId = string | number;
type JsonRpcNotificationObservation = Readonly<{ method: string; hasId: boolean }>;
type JsonRpcRequestObservation = Readonly<{ id: JsonRpcId }>;
type JsonRpcResponseObservation = Readonly<{ id: JsonRpcId }>;
export type JsonRpcTransportConformanceObservation =
  TransportConformanceSharedObservation & Readonly<{
    kind: "json-rpc";
    requests: readonly JsonRpcRequestObservation[];
    responses: readonly JsonRpcResponseObservation[];
    notifications: readonly JsonRpcNotificationObservation[];
  }>;

type ByteTransportLifecycleState = "open" | "closed";
type ByteTransportConformanceObservation<K extends "stdio" | "unix"> =
  TransportConformanceSharedObservation & Readonly<{
    kind: K;
    codec: "json-lines" | "content-length";
    chunks: readonly Uint8Array[];
    expectedValues: readonly unknown[];
    writtenMessageIds: readonly string[];
    lifecycle: readonly ByteTransportLifecycleState[];
  }>;
export type StdioTransportConformanceObservation = ByteTransportConformanceObservation<"stdio">;
export type UnixTransportConformanceObservation = ByteTransportConformanceObservation<"unix">;

type FixtureFor<K extends TransportKind, O> = Readonly<{
  kind: K;
  run(): Promise<O>;
}>;
export type HttpTransportConformanceFixture =
  FixtureFor<"http", HttpTransportConformanceObservation>;
export type SseTransportConformanceFixture = FixtureFor<"sse", SseTransportConformanceObservation>;
export type WebSocketTransportConformanceFixture =
  FixtureFor<"websocket", WebSocketTransportConformanceObservation>;
export type JsonRpcTransportConformanceFixture =
  FixtureFor<"json-rpc", JsonRpcTransportConformanceObservation>;
export type StdioTransportConformanceFixture =
  FixtureFor<"stdio", StdioTransportConformanceObservation>;
export type UnixTransportConformanceFixture =
  FixtureFor<"unix", UnixTransportConformanceObservation>;

export type TransportConformanceFixture =
  | HttpTransportConformanceFixture
  | SseTransportConformanceFixture
  | WebSocketTransportConformanceFixture
  | JsonRpcTransportConformanceFixture
  | StdioTransportConformanceFixture
  | UnixTransportConformanceFixture;

type TransportConformanceObservation =
  | HttpTransportConformanceObservation
  | SseTransportConformanceObservation
  | WebSocketTransportConformanceObservation
  | JsonRpcTransportConformanceObservation
  | StdioTransportConformanceObservation
  | UnixTransportConformanceObservation;

const credentialPatterns = [
  /\bauthorization\b\s*[:=]\s*["']?\s*(?:basic|bearer)\s+[^\s"',;}]+/iu,
  /\bclient_secret\b\s*[:=]\s*["']?[^\s"',;}]+/iu,
  /\b(?:set-cookie|cookie)\b\s*:[^\r\n]*(?:session|sid|auth(?:_token)?|access_token|jwt)\s*=[^;\s]+/iu,
  /[?&](?:access_token|api_key|client_secret|auth|jwt|session)=[^&#\s]+/iu,
] as const;

function exposesAuthenticationMaterial(serialized: string): boolean {
  const withoutRedactions = serialized.replace(/\[REDACTED\]/giu, "");
  return credentialPatterns.some((pattern) => pattern.test(withoutRedactions));
}

function addProtocolIssue(issues: TransportConformanceIssue[], message: string): void {
  issues.push({ code: "protocol_mismatch", message });
}

function hasRepeatedMessageId(values: readonly (string | undefined)[]): boolean {
  const ids = values.filter((value): value is string => value !== undefined && value.length > 0);
  return new Set(ids).size !== ids.length;
}

function inspectHttp(
  observation: HttpTransportConformanceObservation,
  issues: TransportConformanceIssue[],
): number {
  for (const request of observation.requests) {
    if (!Number.isInteger(request.attempt) || request.attempt < 1 ||
      (request.status !== undefined &&
        (!Number.isInteger(request.status) || request.status < 100 || request.status > 599))) {
      addProtocolIssue(issues, "HTTP observations contain an invalid attempt or status.");
      break;
    }
  }
  const operations = new Map<string, HttpRequestObservation[]>();
  for (const request of observation.requests) {
    const grouped = operations.get(request.operationId) ?? [];
    grouped.push(request);
    operations.set(request.operationId, grouped);
  }
  for (const requests of operations.values()) {
    if (requests.length < 2) continue;
    const mutations = requests.filter(({ method }) => method !== "GET" && method !== "HEAD");
    if (mutations.length < 2) continue;
    if (mutations.some(({ idempotencyEligible }) => !idempotencyEligible)) {
      issues.push({ code: "mutation_replayed", message: "HTTP replayed a non-idempotent mutation." });
      continue;
    }
    const keys = new Set(mutations.map(({ idempotencyKey }) => idempotencyKey?.trim() ?? ""));
    if (keys.has("") || keys.size !== 1) {
      addProtocolIssue(issues, "HTTP idempotent retry did not retain one stable non-empty key.");
    }
  }
  return observation.requests.reduce((maximum, request) => Math.max(maximum, request.attempt), 0);
}

function inspectSse(
  observation: SseTransportConformanceObservation,
  issues: TransportConformanceIssue[],
): number {
  if (observation.connections.some(({ requestedCursor, acceptedLastEventId }) =>
    requestedCursor !== undefined && requestedCursor !== acceptedLastEventId)) {
    addProtocolIssue(issues, "SSE reconnect did not resume from the requested cursor.");
  }
  if (new Set(observation.deliveredIds).size !== observation.deliveredIds.length) {
    addProtocolIssue(issues, "SSE delivered an event id more than once.");
  }
  return observation.connections.reduce((maximum, connection) =>
    Math.max(maximum, connection.attempt), 0);
}

function inspectWebSocket(
  observation: WebSocketTransportConformanceObservation,
  issues: TransportConformanceIssue[],
): number {
  const state = new Map<number, "open" | "closed">();
  const lastDelivered = new Map<number, number>();
  const sentGeneration = new Map<string, number>();
  let outOfOrder = false;
  let afterClose = false;
  let replayed = false;
  let connections = 0;
  for (const event of observation.lifecycle) {
    if (event.state === "opened") { state.set(event.generation, "open"); connections += 1; continue; }
    if (event.state === "closed") { state.set(event.generation, "closed"); continue; }
    if (state.get(event.generation) !== "open" && event.state === "delivered") afterClose = true;
    if (event.state === "delivered") {
      const previous = lastDelivered.get(event.generation);
      if (previous !== undefined && event.frame.sequence <= previous) outOfOrder = true;
      lastDelivered.set(event.generation, event.frame.sequence);
    } else if (event.frame.messageId) {
      const previous = sentGeneration.get(event.frame.messageId);
      if (previous !== undefined && previous !== event.generation) replayed = true;
      sentGeneration.set(event.frame.messageId, event.generation);
    }
  }
  if (outOfOrder) addProtocolIssue(issues, "WebSocket delivered frames out of sequence.");
  if (afterClose) addProtocolIssue(issues, "WebSocket delivered a frame after its connection closed.");
  if (replayed) issues.push({ code: "mutation_replayed", message: "WebSocket replayed a message across connections." });
  return connections;
}

function inspectJsonRpc(
  observation: JsonRpcTransportConformanceObservation,
  issues: TransportConformanceIssue[],
): number {
  const requestIds = observation.requests.map(({ id }) => id);
  const responseIds = observation.responses.map(({ id }) => id);
  const requests = new Set(requestIds);
  if (new Set(requestIds).size !== requestIds.length) {
    addProtocolIssue(issues, "JSON-RPC request id is duplicated.");
  }
  if (new Set(responseIds).size !== responseIds.length) {
    addProtocolIssue(issues, "JSON-RPC response id is duplicated.");
  }
  if (responseIds.some((id) => !requests.has(id))) {
    addProtocolIssue(issues, "JSON-RPC response id does not correlate to a request.");
  }
  if (observation.notifications.some(({ hasId }) => hasId)) {
    addProtocolIssue(issues, "JSON-RPC notification unexpectedly contains an id.");
  }
  const responses = new Set(responseIds);
  if (requestIds.some((id) => !responses.has(id))) {
    addProtocolIssue(issues, "JSON-RPC request is unanswered at close.");
  }
  return 1;
}

function inspectBytes(
  observation: StdioTransportConformanceObservation | UnixTransportConformanceObservation,
  issues: TransportConformanceIssue[],
): number {
  const codec = observation.codec === "json-lines" ? jsonLinesCodec() : contentLengthCodec();
  const decoder = codec.createDecoder();
  const decoded: unknown[] = [];
  try {
    for (const chunk of observation.chunks) decoded.push(...decoder.push(chunk));
    decoded.push(...decoder.finish());
    if (JSON.stringify(decoded) !== JSON.stringify(observation.expectedValues)) {
      addProtocolIssue(issues, `${observation.kind} decoded values do not match expectations.`);
    }
  } catch {
    addProtocolIssue(issues, `${observation.kind} framing could not be decoded.`);
  }
  if (hasRepeatedMessageId(observation.writtenMessageIds)) {
    issues.push({
      code: "mutation_replayed",
      message: `${observation.kind} wrote a message more than once.`,
    });
  }
  if (observation.lifecycle.at(-1) !== "closed") {
    issues.push({
      code: "resource_leak",
      message: `${observation.kind} did not reach the closed lifecycle state.`,
    });
  }
  return observation.lifecycle.filter((state) => state === "open").length;
}

const issueCodeOrder = [
  "abort_leak", "unbounded_retry", "mutation_replayed", "secret_exposed",
  "protocol_mismatch", "resource_leak",
] as const satisfies readonly TransportConformanceIssue["code"][];

function canonicalize(issues: readonly TransportConformanceIssue[]): readonly TransportConformanceIssue[] {
  const unique = new Map(issues.map((issue) => [`${issue.code}\0${issue.message}`, issue]));
  return [...unique.values()].sort((left, right) => {
    const codeDifference = issueCodeOrder.indexOf(left.code) - issueCodeOrder.indexOf(right.code);
    if (codeDifference !== 0) return codeDifference;
    return left.message < right.message ? -1 : left.message > right.message ? 1 : 0;
  });
}

export async function inspectTransportConformance(
  fixture: TransportConformanceFixture,
): Promise<TransportConformanceReport> {
  let observation: TransportConformanceObservation;
  try {
    observation = await fixture.run();
  } catch {
    return {
      ok: false,
      kind: fixture.kind,
      issues: [{
        code: "protocol_mismatch",
        message: "The transport fixture could not be inspected safely.",
      }],
    };
  }

  const issues: TransportConformanceIssue[] = [];
  if (observation.emissionsAfterAbort > 0) {
    issues.push({ code: "abort_leak", message: "The transport emitted work after abort completed." });
  }
  if ([...observation.serializedErrors, ...observation.serializedEvents]
    .some(exposesAuthenticationMaterial)) {
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

  let attempts: number;
  switch (observation.kind) {
    case "http": attempts = inspectHttp(observation, issues); break;
    case "sse": attempts = inspectSse(observation, issues); break;
    case "websocket": attempts = inspectWebSocket(observation, issues); break;
    case "json-rpc": attempts = inspectJsonRpc(observation, issues); break;
    case "stdio":
    case "unix": attempts = inspectBytes(observation, issues); break;
  }
  if (attempts > observation.maxAttempts) {
    issues.push({
      code: "unbounded_retry",
      message: `The transport exceeded its configured attempt limit of ${observation.maxAttempts}.`,
    });
  }

  const canonicalIssues = canonicalize(issues);
  return { ok: canonicalIssues.length === 0, kind: fixture.kind, issues: canonicalIssues };
}

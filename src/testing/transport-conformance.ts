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

export type TransportConformanceSharedObservation = Readonly<{
  maxAttempts: number;
  emissionsAfterAbort: number;
  serializedErrors: readonly string[];
  serializedEvents: readonly string[];
  openResources: number;
}>;

type HttpRequestObservation = Readonly<{
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  attempt: number;
  status?: number;
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

type WebSocketConnectionObservation = Readonly<{
  generation: number;
  closedAtSequence?: number;
}>;
type WebSocketFrameObservation = Readonly<{
  direction: "sent" | "delivered";
  sequence: number;
  generation: number;
  messageId?: string;
}>;
export type WebSocketTransportConformanceObservation =
  TransportConformanceSharedObservation & Readonly<{
    kind: "websocket";
    connections: readonly WebSocketConnectionObservation[];
    frames: readonly WebSocketFrameObservation[];
  }>;

type JsonRpcId = string | number;
type JsonRpcNotificationObservation = Readonly<{ method: string; hasId: boolean }>;
export type JsonRpcTransportConformanceObservation =
  TransportConformanceSharedObservation & Readonly<{
    kind: "json-rpc";
    requestIds: readonly JsonRpcId[];
    responseIds: readonly JsonRpcId[];
    notifications: readonly JsonRpcNotificationObservation[];
    pendingAfterClose: number;
  }>;

type ByteFrameObservation = Readonly<{
  bytes: Uint8Array;
  decodedMessages: number;
  messageId?: string;
}>;
type ByteTransportLifecycleState = "open" | "closed";
type ByteTransportConformanceObservation<K extends "stdio" | "unix"> =
  TransportConformanceSharedObservation & Readonly<{
    kind: K;
    frames: readonly ByteFrameObservation[];
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
  /\bset-cookie\b\s*:\s*[^\s,;}]+/iu,
  /\bcookie\b\s*:\s*[^\s,;}]+/iu,
  /[?&](?:access_token|api_key|token)=[^&#\s]+/iu,
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
  const mutations = observation.requests.filter(({ method }) => method !== "GET" && method !== "HEAD");
  const mutationKeys = new Set(mutations.map(({ idempotencyKey }) => idempotencyKey?.trim() ?? ""));
  if (mutations.length > 1 && (mutationKeys.has("") || mutationKeys.size > 1)) {
    issues.push({
      code: "mutation_replayed",
      message: "HTTP retried a mutation without a stable idempotency key.",
    });
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
  const lastDelivered = new Map<number, number>();
  let outOfOrder = false;
  let afterClose = false;
  for (const frame of observation.frames) {
    const connection = observation.connections.find(({ generation }) => generation === frame.generation);
    if (!connection) {
      addProtocolIssue(issues, "WebSocket frame references an unknown connection generation.");
      continue;
    }
    if (frame.direction === "delivered") {
      const previous = lastDelivered.get(frame.generation);
      if (previous !== undefined && frame.sequence <= previous) outOfOrder = true;
      lastDelivered.set(frame.generation, frame.sequence);
      if (connection.closedAtSequence !== undefined && frame.sequence > connection.closedAtSequence) {
        afterClose = true;
      }
    }
  }
  if (outOfOrder) addProtocolIssue(issues, "WebSocket delivered frames out of sequence.");
  if (afterClose) addProtocolIssue(issues, "WebSocket delivered a frame after its connection closed.");
  if (hasRepeatedMessageId(observation.frames
    .filter(({ direction }) => direction === "sent")
    .map(({ messageId }) => messageId))) {
    issues.push({ code: "mutation_replayed", message: "WebSocket sent a message more than once." });
  }
  return observation.connections.length;
}

function inspectJsonRpc(
  observation: JsonRpcTransportConformanceObservation,
  issues: TransportConformanceIssue[],
): number {
  const requests = new Set(observation.requestIds);
  if (observation.responseIds.some((id) => !requests.has(id))) {
    addProtocolIssue(issues, "JSON-RPC response id does not correlate to a request.");
  }
  if (observation.notifications.some(({ hasId }) => hasId)) {
    addProtocolIssue(issues, "JSON-RPC notification unexpectedly contains an id.");
  }
  if (observation.pendingAfterClose > 0) {
    issues.push({
      code: "resource_leak",
      message: "JSON-RPC retained pending requests after close.",
    });
  }
  return 1;
}

function inspectBytes(
  observation: StdioTransportConformanceObservation | UnixTransportConformanceObservation,
  issues: TransportConformanceIssue[],
): number {
  if (observation.frames.some(({ bytes, decodedMessages }) =>
    !Number.isInteger(decodedMessages) || decodedMessages < 0 ||
    (bytes.byteLength === 0 && decodedMessages > 0))) {
    addProtocolIssue(issues, `${observation.kind} decoded an invalid byte frame.`);
  }
  if (hasRepeatedMessageId(observation.frames.map(({ messageId }) => messageId))) {
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
    return codeDifference || left.message.localeCompare(right.message);
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

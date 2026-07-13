import { describe, expect, it } from "vitest";
import type {
  HttpTransportConformanceFixture,
  JsonRpcTransportConformanceFixture,
  SseTransportConformanceFixture,
  StdioTransportConformanceFixture,
  TransportConformanceFixture,
  TransportConformanceSharedObservation,
  TransportKind,
  UnixTransportConformanceFixture,
  WebSocketTransportConformanceFixture,
} from "../../testing/index.js";
import { inspectTransportConformance } from "../../testing/index.js";

const shared = (): TransportConformanceSharedObservation => ({
  maxAttempts: 1,
  emissionsAfterAbort: 0,
  serializedErrors: [],
  serializedEvents: [],
  openResources: 0,
});

const compliant = {
  http: (): HttpTransportConformanceFixture => ({ kind: "http", run: async () => ({
    ...shared(), kind: "http", requests: [{ method: "GET", attempt: 1, status: 200 }],
  }) }),
  sse: (): SseTransportConformanceFixture => ({ kind: "sse", run: async () => ({
    ...shared(), kind: "sse", connections: [{ attempt: 1 }], deliveredIds: ["1", "2"],
  }) }),
  websocket: (): WebSocketTransportConformanceFixture => ({ kind: "websocket", run: async () => ({
    ...shared(), kind: "websocket", connections: [{ generation: 1 }],
    frames: [{ direction: "sent", sequence: 1, generation: 1 }],
  }) }),
  "json-rpc": (): JsonRpcTransportConformanceFixture => ({ kind: "json-rpc", run: async () => ({
    ...shared(), kind: "json-rpc", requestIds: [1], responseIds: [1],
    notifications: [{ method: "progress", hasId: false }], pendingAfterClose: 0,
  }) }),
  stdio: (): StdioTransportConformanceFixture => ({ kind: "stdio", run: async () => ({
    ...shared(), kind: "stdio", frames: [{ bytes: new Uint8Array([1]), decodedMessages: 1 }],
    lifecycle: ["open", "closed"],
  }) }),
  unix: (): UnixTransportConformanceFixture => ({ kind: "unix", run: async () => ({
    ...shared(), kind: "unix", frames: [{ bytes: new Uint8Array([1]), decodedMessages: 1 }],
    lifecycle: ["open", "closed"],
  }) }),
} satisfies Record<TransportKind, () => TransportConformanceFixture>;

describe("inspectTransportConformance", () => {
  it.each(Object.keys(compliant) as TransportKind[])("accepts a conformant %s fixture", async (kind) => {
    await expect(inspectTransportConformance(compliant[kind]())).resolves.toEqual({
      ok: true, kind, issues: [],
    });
  });

  it("derives an HTTP protocol failure and unsafe mutation retry", async () => {
    const fixture: HttpTransportConformanceFixture = { kind: "http", run: async () => ({
      ...shared(), kind: "http", maxAttempts: 2,
      requests: [
        { method: "POST", attempt: 1, status: 503 },
        { method: "POST", attempt: 2, status: 99 },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(expect.arrayContaining(["mutation_replayed", "protocol_mismatch"]));
  });

  it("allows an HTTP mutation retry with a stable idempotency key", async () => {
    const fixture: HttpTransportConformanceFixture = { kind: "http", run: async () => ({
      ...shared(), kind: "http", maxAttempts: 2,
      requests: [
        { method: "POST", attempt: 1, status: 503, idempotencyKey: "operation-1" },
        { method: "POST", attempt: 2, status: 200, idempotencyKey: "operation-1" },
      ],
    }) };
    expect(await inspectTransportConformance(fixture)).toEqual({
      ok: true, kind: "http", issues: [],
    });
  });

  it("derives SSE resume and duplicate-delivery failures", async () => {
    const fixture: SseTransportConformanceFixture = { kind: "sse", run: async () => ({
      ...shared(), kind: "sse", maxAttempts: 2,
      connections: [{ attempt: 1 }, { attempt: 2, requestedCursor: "2", acceptedLastEventId: "1" }],
      deliveredIds: ["1", "2", "2"],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(["protocol_mismatch", "protocol_mismatch"]);
  });

  it("derives WebSocket ordering and post-close delivery failures", async () => {
    const fixture: WebSocketTransportConformanceFixture = { kind: "websocket", run: async () => ({
      ...shared(), kind: "websocket", connections: [{ generation: 1, closedAtSequence: 2 }],
      frames: [
        { direction: "sent", sequence: 1, generation: 1, messageId: "mutation-1" },
        { direction: "sent", sequence: 2, generation: 1, messageId: "mutation-1" },
        { direction: "delivered", sequence: 2, generation: 1 },
        { direction: "delivered", sequence: 1, generation: 1 },
        { direction: "delivered", sequence: 3, generation: 1 },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(["mutation_replayed", "protocol_mismatch", "protocol_mismatch"]);
  });

  it("derives JSON-RPC correlation, notification, and close failures", async () => {
    const fixture: JsonRpcTransportConformanceFixture = { kind: "json-rpc", run: async () => ({
      ...shared(), kind: "json-rpc", requestIds: [1], responseIds: [2],
      notifications: [{ method: "progress", hasId: true }], pendingAfterClose: 1,
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(["protocol_mismatch", "protocol_mismatch", "resource_leak"]);
  });

  it.each(["stdio", "unix"] as const)("derives %s framing and lifecycle failures", async (kind) => {
    const fixture = { kind, run: async () => ({
      ...shared(), kind, frames: [
        { bytes: new Uint8Array(), decodedMessages: 1, messageId: "mutation-1" },
        { bytes: new Uint8Array([1]), decodedMessages: 1, messageId: "mutation-1" },
      ], lifecycle: ["open" as const],
    }) } as StdioTransportConformanceFixture | UnixTransportConformanceFixture;
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(["mutation_replayed", "protocol_mismatch", "resource_leak"]);
  });

  it("reports abort and retry bounds from raw fixture observations", async () => {
    const fixture = compliant.sse();
    const report = await inspectTransportConformance({ ...fixture, run: async () => ({
      ...(await fixture.run()), maxAttempts: 1, emissionsAfterAbort: 2,
      connections: [{ attempt: 1 }, { attempt: 2 }],
    }) });
    expect(report.issues.map(({ code }) => code)).toEqual(["abort_leak", "unbounded_retry"]);
  });

  it.each([
    "Authorization: Basic dXNlcjpwYXNz",
    "authorization='Bearer quoted-secret'",
    "client_secret=hunter2",
    "Cookie: session=secret",
    "Set-Cookie: sid=secret",
    "https://example.test/?access_token=secret",
    "https://example.test/?api_key=secret",
    "https://example.test/?token=secret",
  ])("detects authentication material: %s", async (serialized) => {
    const fixture = compliant.http();
    const report = await inspectTransportConformance({ ...fixture, run: async () => ({
      ...(await fixture.run()), serializedErrors: [serialized],
    }) });
    expect(report.issues.map(({ code }) => code)).toContain("secret_exposed");
  });

  it.each([
    "Authorization: Bearer [REDACTED]",
    "Authorization: Basic [redacted]",
    "client_secret=[REDACTED]",
    "token budget exceeded",
    "cookie policy accepted",
  ])("does not flag redacted or benign text: %s", async (serialized) => {
    const fixture = compliant.http();
    const report = await inspectTransportConformance({ ...fixture, run: async () => ({
      ...(await fixture.run()), serializedEvents: [serialized],
    }) });
    expect(report.ok).toBe(true);
  });

  it("returns fixed safe data when fixture execution throws a secret", async () => {
    const report = await inspectTransportConformance({
      kind: "http", run: async () => { throw new Error("Bearer must-not-leak"); },
    });
    expect(report).toEqual({
      ok: false,
      kind: "http",
      issues: [{ code: "protocol_mismatch", message: "The transport fixture could not be inspected safely." }],
    });
    expect(JSON.stringify(report)).not.toContain("must-not-leak");
  });

  it("deduplicates and orders issues independently of observation order", async () => {
    const make = (events: readonly string[], ids: readonly string[]): SseTransportConformanceFixture => ({
      kind: "sse", run: async () => ({
        ...shared(), kind: "sse", emissionsAfterAbort: 1, openResources: 1,
        serializedEvents: events, connections: [{ attempt: 1 }], deliveredIds: ids,
      }),
    });
    const left = await inspectTransportConformance(make(
      ["Cookie: a=secret", "Authorization: Bearer secret"], ["1", "1", "1"],
    ));
    const right = await inspectTransportConformance(make(
      ["Authorization: Bearer secret", "Cookie: a=secret"], ["1", "1"],
    ));
    expect(left).toEqual(right);
  });
});

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
const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const compliant = {
  http: (): HttpTransportConformanceFixture => ({ kind: "http", run: async () => ({
    ...shared(), kind: "http", requests: [{
      operationId: "read-1", method: "GET", attempt: 1, status: 200, idempotencyEligible: true,
    }],
  }) }),
  sse: (): SseTransportConformanceFixture => ({ kind: "sse", run: async () => ({
    ...shared(), kind: "sse", connections: [{ attempt: 1 }], deliveredIds: ["1", "2"],
  }) }),
  websocket: (): WebSocketTransportConformanceFixture => ({ kind: "websocket", run: async () => ({
    ...shared(), kind: "websocket", lifecycle: [
      { state: "opened", generation: 1 },
      { state: "sent", generation: 1, frame: { sequence: 1, messageId: "read-1" } },
      { state: "closed", generation: 1 },
    ],
  }) }),
  "json-rpc": (): JsonRpcTransportConformanceFixture => ({ kind: "json-rpc", run: async () => ({
    ...shared(), kind: "json-rpc", requests: [{ id: 1 }], responses: [{ id: 1 }],
    notifications: [{ method: "progress", hasId: false }],
  }) }),
  stdio: (): StdioTransportConformanceFixture => ({ kind: "stdio", run: async () => ({
    ...shared(), kind: "stdio", codec: "json-lines", chunks: [bytes("{\"ok\":true}\n")],
    expectedValues: [{ ok: true }], writtenMessageIds: ["read-1"], lifecycle: ["open", "closed"],
  }) }),
  unix: (): UnixTransportConformanceFixture => ({ kind: "unix", run: async () => ({
    ...shared(), kind: "unix", codec: "content-length",
    chunks: [bytes("Content-Length: 11\r\n\r\n{\"ok\":true}")],
    expectedValues: [{ ok: true }], writtenMessageIds: ["read-1"], lifecycle: ["open", "closed"],
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
        { operationId: "write-1", method: "POST", attempt: 1, status: 503, idempotencyEligible: false },
        { operationId: "write-1", method: "POST", attempt: 2, status: 99, idempotencyEligible: false },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(expect.arrayContaining(["mutation_replayed", "protocol_mismatch"]));
  });

  it("allows an HTTP mutation retry with a stable idempotency key", async () => {
    const fixture: HttpTransportConformanceFixture = { kind: "http", run: async () => ({
      ...shared(), kind: "http", maxAttempts: 2,
      requests: [
        { operationId: "write-1", method: "POST", attempt: 1, status: 503,
          idempotencyEligible: true, idempotencyKey: " operation-1 " },
        { operationId: "write-1", method: "POST", attempt: 2, status: 200,
          idempotencyEligible: true, idempotencyKey: "operation-1" },
      ],
    }) };
    expect(await inspectTransportConformance(fixture)).toEqual({
      ok: true, kind: "http", issues: [],
    });
  });

  it("allows two distinct non-idempotent mutations", async () => {
    const fixture: HttpTransportConformanceFixture = { kind: "http", run: async () => ({
      ...shared(), kind: "http", requests: [
        { operationId: "write-1", method: "POST", attempt: 1, status: 200, idempotencyEligible: false },
        { operationId: "write-2", method: "POST", attempt: 1, status: 200, idempotencyEligible: false },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).ok).toBe(true);
  });

  it("rejects a changed idempotency key across one operation", async () => {
    const fixture: HttpTransportConformanceFixture = { kind: "http", run: async () => ({
      ...shared(), kind: "http", maxAttempts: 2, requests: [
        { operationId: "write-1", method: "POST", attempt: 1, status: 503,
          idempotencyEligible: true, idempotencyKey: "key-1" },
        { operationId: "write-1", method: "POST", attempt: 2, status: 200,
          idempotencyEligible: true, idempotencyKey: "key-2" },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toContain("protocol_mismatch");
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
      ...shared(), kind: "websocket", maxAttempts: 2, lifecycle: [
        { state: "opened", generation: 1 },
        { state: "sent", generation: 1, frame: { sequence: 1, messageId: "mutation-1" } },
        { state: "closed", generation: 1 },
        { state: "delivered", generation: 1, frame: { sequence: 1 } },
        { state: "opened", generation: 2 },
        { state: "sent", generation: 2, frame: { sequence: 1, messageId: "mutation-1" } },
        { state: "delivered", generation: 2, frame: { sequence: 2 } },
        { state: "delivered", generation: 2, frame: { sequence: 1 } },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(["mutation_replayed", "protocol_mismatch", "protocol_mismatch"]);
  });

  it("derives same-generation WebSocket replay", async () => {
    const fixture: WebSocketTransportConformanceFixture = { kind: "websocket", run: async () => ({
      ...shared(), kind: "websocket", lifecycle: [
        { state: "opened", generation: 1 },
        { state: "sent", generation: 1, frame: { sequence: 1, messageId: "mutation-1" } },
        { state: "sent", generation: 1, frame: { sequence: 2, messageId: "mutation-1" } },
        { state: "closed", generation: 1 },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual(["mutation_replayed"]);
  });

  it.each(["sent", "delivered"] as const)("rejects pre-open and post-close %s events", async (state) => {
    const fixture: WebSocketTransportConformanceFixture = { kind: "websocket", run: async () => ({
      ...shared(), kind: "websocket", lifecycle: [
        { state, generation: 1, frame: { sequence: 1 } },
        { state: "opened", generation: 1 },
        { state: "closed", generation: 1 },
        { state, generation: 1, frame: { sequence: 2 } },
      ],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toContain("protocol_mismatch");
  });

  it("derives JSON-RPC correlation, notification, and close failures", async () => {
    const fixture: JsonRpcTransportConformanceFixture = { kind: "json-rpc", run: async () => ({
      ...shared(), kind: "json-rpc", requests: [{ id: 1 }, { id: 1 }, { id: 3 }],
      responses: [{ id: 2 }, { id: 2 }], notifications: [{ method: "progress", hasId: true }],
    }) };
    expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
      .toEqual([
        "protocol_mismatch", "protocol_mismatch", "protocol_mismatch",
        "protocol_mismatch", "protocol_mismatch",
      ]);
  });

  it.each(["stdio", "unix"] as const)("derives %s malformed and truncated framing", async (kind) => {
    for (const [codec, chunks] of [
      ["json-lines", [bytes("{bad}\n")]],
      ["content-length", [bytes("Content-Length: 9\r\n\r\n{}")]],
    ] as const) {
      const fixture = { kind, run: async () => ({
        ...shared(), kind, codec, chunks, expectedValues: [], writtenMessageIds: [],
        lifecycle: ["open" as const, "closed" as const],
      }) } as StdioTransportConformanceFixture | UnixTransportConformanceFixture;
      expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
        .toContain("protocol_mismatch");
    }
  });

  it.each(["stdio", "unix"] as const)("decodes multiple %s frames across chunks", async (kind) => {
    const fixture = { kind, run: async () => ({
      ...shared(), kind, codec: "json-lines" as const,
      chunks: [bytes("{\"n\":1}\n{\"n\":"), bytes("2}\n")],
      expectedValues: [{ n: 1 }, { n: 2 }], writtenMessageIds: ["1", "2"],
      lifecycle: ["open" as const, "closed" as const],
    }) } as StdioTransportConformanceFixture | UnixTransportConformanceFixture;
    expect((await inspectTransportConformance(fixture)).ok).toBe(true);
  });

  it.each(["stdio", "unix"] as const)("derives %s header, trailing, and decode mismatches", async (kind) => {
    for (const observation of [
      { codec: "content-length" as const, chunks: [bytes("Bad: 2\r\n\r\n{}")], expectedValues: [] },
      { codec: "content-length" as const,
        chunks: [bytes("Content-Length: 2\r\n\r\n{}trailing")], expectedValues: [{}] },
      { codec: "json-lines" as const, chunks: [bytes("{\"actual\":1}\n")], expectedValues: [{ expected: 1 }] },
    ]) {
      const fixture = { kind, run: async () => ({
        ...shared(), kind, ...observation, writtenMessageIds: [],
        lifecycle: ["open" as const, "closed" as const],
      }) } as StdioTransportConformanceFixture | UnixTransportConformanceFixture;
      expect((await inspectTransportConformance(fixture)).issues.map(({ code }) => code))
        .toContain("protocol_mismatch");
    }
  });

  it.each(["stdio", "unix"] as const)("compares %s decoded object keys structurally", async (kind) => {
    const fixture = { kind, run: async () => ({
      ...shared(), kind, codec: "json-lines" as const,
      chunks: [bytes("{\"alpha\":1,\"beta\":2}\n")],
      expectedValues: [{ beta: 2, alpha: 1 }], writtenMessageIds: [],
      lifecycle: ["open" as const, "closed" as const],
    }) } as StdioTransportConformanceFixture | UnixTransportConformanceFixture;
    expect((await inspectTransportConformance(fixture)).ok).toBe(true);
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
    "Cookie: session=secret; theme=dark",
    "Set-Cookie: auth_token=secret",
    "https://example.test/?access_token=secret",
    "https://example.test/?api_key=secret",
    "https://example.test/?jwt=secret",
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
    "Cookie: theme=dark; locale=en-US",
    "Cookie: not_session=secret; authorization_theme=dark",
    "https://example.test/?token=page-2",
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

  it("orders issues without locale-sensitive comparison", async () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => { throw new Error("locale-sensitive comparator used"); };
    try {
      const fixture = compliant.sse();
      await expect(inspectTransportConformance({ ...fixture, run: async () => ({
        ...(await fixture.run()), deliveredIds: ["2", "2"], openResources: 1,
      }) })).resolves.toEqual(expect.objectContaining({ ok: false }));
    } finally {
      String.prototype.localeCompare = original;
    }
  });
});

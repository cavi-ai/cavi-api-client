import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CapabilityUnavailable } from "../../../../../core/runtime/control-plane/runtime-control-client.js";
import type { TransportMessageChannel } from "../../../../../core/transport/channel.js";
import { GATEWAY_RAW_EXTENSION } from "../../../../../core/runtime/control-plane/raw-gateway.js";
import type { GatewayRpcClientOptions } from "../../../../../core/gateway/rpc/client.js";

const webSocketConnect = vi.hoisted(() => vi.fn());
vi.mock("../../../../../core/transport/websocket.js", () => ({
  createWebSocketTransport: () => ({ connect: webSocketConnect }),
}));

import { createHermesRuntimeControlClient } from "../../../../../extensions/cavi/providers/hermes/runtime-control-client.js";

const apiFixture = (name: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(
  `../../../../fixtures/hermes/api-server/${name}.json`, import.meta.url,
)), "utf8")) as unknown;

function channel(closed = false): TransportMessageChannel<unknown> & { close: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => {}),
    subscribeClose: vi.fn((listener: (error?: unknown) => void) => {
      if (closed) listener();
      return () => {};
    }),
    close: vi.fn(async () => {}),
  };
}

function caviOptions() {
  return { gatewayBaseUrl: "https://gateway.test", authToken: null, fallbackMode: "compat" as const };
}

const shape = [
  "authStatus", "dispose", "events", "extensions", "models", "sessions", "tasks", "usage", "workspace",
];

describe("createHermesRuntimeControlClient", () => {
  it("preserves an already-aborted request through the API Server HTTP layer without fetching", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(new Response(
      JSON.stringify(apiFixture("capabilities")),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://api.example",
      fetch,
    });
    const controller = new AbortController();
    const reason = new DOMException("cancelled before dispatch", "AbortError");
    controller.abort(reason);

    await expect(client.sessions.listSessions({ signal: controller.signal })).rejects.toBe(reason);
    expect(fetch).toHaveBeenCalledTimes(1);
    await client.dispose();
  });

  it("uses the Hermes API Server REST surface by default and never invents dashboard transport", async () => {
    const requested: string[] = [];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      requested.push(path);
      const payloads: Record<string, unknown> = {
        "/v1/capabilities": apiFixture("capabilities"),
        "/v1/models": apiFixture("models"),
        "/api/sessions/list": apiFixture("sessions-list"),
        "/api/sessions/usage": apiFixture("sessions-usage"),
      };
      return new Response(JSON.stringify(payloads[path]), { status: 200, headers: { "content-type": "application/json" } });
    });
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://martavis.example", token: "api-server-key", fetch,
    });

    await expect(client.models.listModels()).resolves.toMatchObject({ data: [{ id: "hermes-live", providerId: "hermes", availability: "available" }] });
    await expect(client.sessions.listSessions()).resolves.toMatchObject({ data: [{ id: "session-1", title: "Live session", state: "active" }] });
    await expect(client.usage.getUsage()).resolves.toMatchObject({
      tokens: { totalTokens: 42, raw: { requests: 2, toolCalls: 1, errors: 0 } },
      cost: { availability: "unavailable" }, aggregation: "api-server-sessions",
    });
    await expect(client.authStatus.listAuthStatus()).rejects.toEqual(
      new CapabilityUnavailable("hermes", "controlPlane.authStatus.list"),
    );
    await expect(client.tasks.listTasks()).rejects.toEqual(
      new CapabilityUnavailable("hermes", "controlPlane.tasks.list"),
    );
    expect(client.extensions.get(GATEWAY_RAW_EXTENSION)).toBeUndefined();
    expect(requested).toEqual([
      "/v1/capabilities", "/v1/models", "/api/sessions/list", "/api/sessions/usage",
    ]);
    expect(requested).not.toEqual(expect.arrayContaining([
      "/api/provider-auth", "/api/models", "/api/analytics/usage", "/api/sessions", "/api/ws",
    ]));
    await client.dispose();
  });

  it("keeps an explicitly configured dashboard alongside the API Server without changing API routes", async () => {
    const requested: string[] = [];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      requested.push(`${url.origin}${url.pathname}`);
      const payload = url.pathname === "/v1/capabilities"
        ? { object: "hermes.api_server.capabilities", platform: "hermes-agent", auth: { type: "bearer", required: true }, features: {}, endpoints: {} }
        : { providers: [] };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    });
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://api.example", dashboardBaseUrl: "https://dashboard.example", fetch,
    });
    await client.authStatus.listAuthStatus();
    expect(requested).toEqual([
      "https://api.example/v1/capabilities",
      "https://dashboard.example/api/provider-auth",
    ]);
    expect(client.extensions.get(GATEWAY_RAW_EXTENSION)).toBeUndefined();
    await client.dispose();
  });

  it("keeps API Server resolved auth independent from an explicit dashboard token", async () => {
    const requests: Array<{ origin: string; path: string; authorization: string }> = [];
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push({
        origin: url.origin,
        path: url.pathname,
        authorization: new Headers(init?.headers).get("authorization") ?? "",
      });
      const payload = url.pathname === "/v1/capabilities"
        ? apiFixture("capabilities")
        : url.pathname === "/v1/models"
          ? apiFixture("models")
          : { providers: [] };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    });
    const resolveAuth = vi.fn(async () => ({ headers: {
      Authorization: "Bearer api-resolved", "X-Api-Tenant": "tenant-1",
    } }));
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://api.example",
      token: "api-stale",
      resolveAuth,
      dashboardBaseUrl: "https://dashboard.example",
      dashboardToken: "dashboard-only",
      fetch,
    });
    await client.models.listModels();
    await client.authStatus.listAuthStatus();

    expect(resolveAuth).toHaveBeenCalledTimes(1);
    expect(requests).toEqual([
      { origin: "https://api.example", path: "/v1/capabilities", authorization: "Bearer api-resolved" },
      { origin: "https://api.example", path: "/v1/models", authorization: "Bearer api-resolved" },
      { origin: "https://dashboard.example", path: "/api/provider-auth", authorization: "Bearer dashboard-only" },
    ]);
    await client.dispose();
  });

  it("turns absent optional API Server surfaces into typed capability unavailability", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      return path === "/v1/capabilities"
        ? new Response(JSON.stringify(apiFixture("capabilities")), { status: 200, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
    });
    const client = await createHermesRuntimeControlClient({ baseUrl: "https://api.example", fetch });
    await expect(client.models.listModels()).rejects.toEqual(new CapabilityUnavailable("hermes", "controlPlane.models.list"));
    await expect(client.sessions.listSessions()).rejects.toEqual(new CapabilityUnavailable("hermes", "controlPlane.sessions.list"));
    await expect(client.usage.getUsage()).rejects.toEqual(new CapabilityUnavailable("hermes", "controlPlane.usage.get"));
    await client.dispose();
  });

  it("binds canonical events to an explicitly supplied existing API Server run id", async () => {
    const requested: string[] = [];
    const authorizations: string[] = [];
    const encoder = new TextEncoder();
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      requested.push(path);
      authorizations.push(new Headers(init?.headers).get("authorization") ?? "");
      if (path === "/v1/capabilities") return new Response(JSON.stringify({
        object: "hermes.api_server.capabilities", platform: "hermes-agent",
        auth: { type: "bearer", required: true }, features: { run_events_sse: true }, endpoints: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(encoder.encode('data: {"event":"run.completed","run_id":"existing-run"}\n\n'));
        controller.close();
      } }), { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://api.example", token: "stale", fetch,
      resolveAuth: async () => ({ headers: { Authorization: "Bearer resolved-key" } }),
      apiServerRunEvents: { runId: "existing-run", sessionKey: "existing-session", clientId: "consumer" },
    });
    const events: unknown[] = [];
    await client.events.subscribe({ operationId: "existing-run" }, { onEvent: (event) => events.push(event) });
    await vi.waitFor(() => expect(events).toEqual([expect.objectContaining({
      event: "operation.completed", operationId: "existing-run",
    })]));
    expect(requested).toEqual(["/v1/capabilities", "/v1/runs/existing-run/events"]);
    expect(authorizations).toEqual(["Bearer resolved-key", "Bearer resolved-key"]);
    await client.dispose();
  });

  it("owns and aborts active API Server SSE subscriptions on idempotent runtime disposal", async () => {
    let streamSignal: AbortSignal | undefined;
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/v1/capabilities") return new Response(JSON.stringify(apiFixture("capabilities")), {
        status: 200, headers: { "content-type": "application/json" },
      });
      streamSignal = init?.signal ?? undefined;
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { streamController = controller; },
      }), { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const onEvent = vi.fn();
    const onError = vi.fn();
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://api.example", fetch,
      apiServerRunEvents: { runId: "existing-run", sessionKey: "existing-session", clientId: "consumer" },
    });
    await client.events.subscribe({ operationId: "existing-run" }, { onEvent, onError });
    await vi.waitFor(() => expect(streamSignal).toBeDefined());

    await Promise.all([client.dispose(), client.dispose()]);
    expect(streamSignal?.aborted).toBe(true);
    expect(() => streamController?.enqueue(
      new TextEncoder().encode('data: {"event":"run.completed"}\n\n'),
    )).toThrow("Controller is already closed");
    await Promise.resolve();
    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("releases naturally completed API Server SSE subscriptions before later disposal", async () => {
    let streamSignal: AbortSignal | undefined;
    const encoder = new TextEncoder();
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/v1/capabilities") return new Response(JSON.stringify(apiFixture("capabilities")), {
        status: 200, headers: { "content-type": "application/json" },
      });
      streamSignal = init?.signal ?? undefined;
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(encoder.encode('data: {"event":"run.completed","run_id":"existing-run"}\n\n'));
        controller.close();
      } }), { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const onEvent = vi.fn();
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://api.example", fetch,
      apiServerRunEvents: { runId: "existing-run", sessionKey: "existing-session", clientId: "consumer" },
    });
    const subscription = await client.events.subscribe(
      { operationId: "existing-run" }, { onEvent },
    );
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));

    await client.dispose();
    await subscription.dispose();
    await subscription.dispose();
    expect(streamSignal?.aborted).toBe(false);
  });

  it("releases failed API Server SSE subscriptions after isolated error delivery", async () => {
    let streamSignal: AbortSignal | undefined;
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/v1/capabilities") return new Response(JSON.stringify(apiFixture("capabilities")), {
        status: 200, headers: { "content-type": "application/json" },
      });
      streamSignal = init?.signal ?? undefined;
      return new Response("stream failed", { status: 500, headers: { "content-type": "text/plain" } });
    });
    const onError = vi.fn(() => { throw new Error("listener failure is isolated"); });
    const client = await createHermesRuntimeControlClient({
      baseUrl: "https://api.example", fetch,
      apiServerRunEvents: { runId: "existing-run", sessionKey: "existing-session", clientId: "consumer" },
    });
    const subscription = await client.events.subscribe(
      { operationId: "existing-run" }, { onEvent: vi.fn(), onError },
    );
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    await client.dispose();
    await subscription.dispose();
    expect(streamSignal?.aborted).toBe(false);
  });
  it("rejects reconnect policy explicitly because a terminal Hermes channel cannot be rebuilt", async () => {
    await expect(createHermesRuntimeControlClient({
      dashboardWebSocketUrl: "wss://dashboard.test/rpc",
      gatewayReconnect: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 },
    })).rejects.toEqual(new CapabilityUnavailable(
      "hermes",
      "runtimeControl.gatewayReconnect",
    ));
    expect(webSocketConnect).not.toHaveBeenCalled();
  });

  it("reports manual reconnect as unavailable after a fixed Hermes channel closes", async () => {
    const client = await createHermesRuntimeControlClient({ channel: channel(true) });
    const raw = client.extensions.get(GATEWAY_RAW_EXTENSION)!;

    await expect(raw.connect()).rejects.toEqual(new CapabilityUnavailable(
      "hermes",
      "gateway.raw.reconnect",
    ));
    await client.dispose();
  });
  const unsupportedGatewayConnectionCases = {
    clientId: { clientId: "mobile-client" },
    clientVersion: { clientVersion: "1.0.0" },
    clientMode: { clientMode: "mobile" },
    clientPlatform: { clientPlatform: "react-native" },
    connectFrameId: { connectFrameId: "client-id" },
    minProtocol: { minProtocol: 3 },
    maxProtocol: { maxProtocol: 5 },
    enableDeviceIdentity: { enableDeviceIdentity: true },
    deviceIdentityLoader: { deviceIdentityLoader: async () => null },
    requestedScopes: { requestedScopes: ["operator.write"] },
    preauthHandshakeTimeoutMs: { preauthHandshakeTimeoutMs: 1_000 },
    preauthHandshakeEnv: { preauthHandshakeEnv: { TEST_TIMEOUT: "1000" } },
    preauthHandshakeEnvKeys: { preauthHandshakeEnvKeys: { timeoutMs: "TEST_TIMEOUT" } },
    requestTimeoutMs: { requestTimeoutMs: 1_000 },
    maxConcurrentRequests: { maxConcurrentRequests: 2 },
    defaultRequestedScopes: { defaultRequestedScopes: ["operator.read"] },
    onRpcTrace: { onRpcTrace: () => undefined },
  } satisfies Record<keyof GatewayRpcClientOptions, GatewayRpcClientOptions>;
  const unsupportedGatewayConnections = Object.entries(unsupportedGatewayConnectionCases) as
    Array<[keyof GatewayRpcClientOptions, GatewayRpcClientOptions]>;

  it.each(unsupportedGatewayConnections)("rejects unsupported gatewayConnection.%s without opening a transport", async (field, gatewayConnection) => {
    await expect(createHermesRuntimeControlClient({
      dashboardWebSocketUrl: "wss://dashboard.test/rpc",
      gatewayConnection,
    })).rejects.toEqual(new CapabilityUnavailable("hermes", `runtimeControl.gatewayConnection.${field}`));
    expect(webSocketConnect).not.toHaveBeenCalled();
  });

  it.each([
    ["omitted", undefined],
    ["empty", {}],
    ["explicitly undefined", Object.fromEntries(
      Object.keys(unsupportedGatewayConnectionCases).map((field) => [field, undefined]),
    ) as GatewayRpcClientOptions],
  ] as const)("accepts %s gateway connection settings without opening a transport", async (_label, gatewayConnection) => {
    const client = await createHermesRuntimeControlClient({ gatewayConnection });
    expect(webSocketConnect).not.toHaveBeenCalled();
    expect(client.extensions.get(GATEWAY_RAW_EXTENSION)).toBeUndefined();
    await client.dispose();
  });

  it.each([
    ["requestedScopes", { requestedScopes: [] }],
    ["blank requestedScopes", { requestedScopes: ["", "   "] }],
    ["defaultRequestedScopes", { defaultRequestedScopes: [] }],
    ["zero requestTimeoutMs", { requestTimeoutMs: 0 }],
    ["zero maxConcurrentRequests", { maxConcurrentRequests: 0 }],
    ["zero preauthHandshakeTimeoutMs", { preauthHandshakeTimeoutMs: 0 }],
  ] as const)("accepts semantically omitted %s without opening a transport", async (_label, gatewayConnection) => {
    const client = await createHermesRuntimeControlClient({ gatewayConnection });
    expect(webSocketConnect).not.toHaveBeenCalled();
    expect(client.extensions.get(GATEWAY_RAW_EXTENSION)).toBeUndefined();
    await client.dispose();
  });

  it("rejects an empty pre-auth env because it overrides ambient env lookup", async () => {
    await expect(createHermesRuntimeControlClient({
      gatewayConnection: { preauthHandshakeEnv: {} },
    })).rejects.toEqual(new CapabilityUnavailable(
      "hermes",
      "runtimeControl.gatewayConnection.preauthHandshakeEnv",
    ));
    expect(webSocketConnect).not.toHaveBeenCalled();
  });

  it.each([
    ["minProtocol", { minProtocol: 0 }],
    ["maxProtocol", { maxProtocol: 0 }],
  ] as const)("rejects protocol zero for %s because shared RPC validates it", async (field, gatewayConnection) => {
    await expect(createHermesRuntimeControlClient({ gatewayConnection }))
      .rejects.toEqual(new CapabilityUnavailable(
        "hermes",
        `runtimeControl.gatewayConnection.${field}`,
      ));
    expect(webSocketConnect).not.toHaveBeenCalled();
  });

  it("always returns the complete canonical shape", async () => {
    const unavailable = await createHermesRuntimeControlClient({ dashboardBaseUrl: "" });
    const partial = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test" });
    const configured = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: channel(),
    });
    expect(Object.keys(unavailable).sort()).toEqual(shape);
    expect(Object.keys(partial).sort()).toEqual(shape);
    expect(Object.keys(configured).sort()).toEqual(shape);
    await Promise.all([unavailable.dispose(), partial.dispose(), configured.dispose()]);
  });

  it("uses exact unavailable capability errors per operation", async () => {
    const client = await createHermesRuntimeControlClient({ dashboardBaseUrl: "" });
    const operations = [
      [() => client.authStatus.listAuthStatus(), "controlPlane.authStatus.list"],
      [() => client.sessions.listSessions(), "controlPlane.sessions.list"],
      [() => client.models.listModels(), "controlPlane.models.list"],
      [() => client.usage.getUsage(), "controlPlane.usage.get"],
      [() => client.tasks.listTasks(), "controlPlane.tasks.list"],
      [() => client.workspace.listWorkspaces(), "controlPlane.workspace.list"],
      [() => client.events.subscribe({ operationId: "op", onEvent() {} }), "controlPlane.events.subscribe"],
    ] as const;
    for (const [invoke, capability] of operations) {
      await expect(invoke()).rejects.toMatchObject({
        name: "CapabilityUnavailable", providerId: "hermes", capability,
      } satisfies Partial<CapabilityUnavailable>);
    }
  });

  it("keeps injected channels borrowed unless ownership is explicit and disposes idempotently", async () => {
    const borrowed = channel();
    const borrowedClient = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test", channel: borrowed });
    await borrowedClient.dispose();
    await borrowedClient.dispose();
    expect(borrowed.close).not.toHaveBeenCalled();

    const owned = channel();
    const ownedClient = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test", channel: owned, ownsChannel: true });
    await ownedClient.dispose();
    await ownedClient.dispose();
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("installs gateway.raw only with JSON-RPC and shares exact-once runtime ownership", async () => {
    const restOnly = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
    });
    expect(restOnly.extensions.get(GATEWAY_RAW_EXTENSION)).toBeUndefined();
    await restOnly.dispose();

    const owned = channel();
    const client = await createHermesRuntimeControlClient({ channel: owned, ownsChannel: true });
    const raw = client.extensions.get(GATEWAY_RAW_EXTENSION);
    expect(raw).toBeDefined();

    await Promise.all([raw!.dispose(), client.dispose(), client.dispose(), raw!.dispose()]);
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("keeps injected transports non-owned and removes raw lifecycle listeners idempotently", async () => {
    const borrowed = channel();
    const closeListeners = new Set<(error?: unknown) => void>();
    borrowed.subscribeClose = vi.fn((listener) => {
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    });
    const client = await createHermesRuntimeControlClient({ channel: borrowed });
    const raw = client.extensions.get(GATEWAY_RAW_EXTENSION)!;
    const unsubscribe = raw.onConnectionState(() => undefined);
    unsubscribe();
    unsubscribe();
    await Promise.all([client.dispose(), raw.dispose()]);

    expect(closeListeners).toHaveLength(0);
    expect(borrowed.close).not.toHaveBeenCalled();
  });

  it("handles an already-closed injected channel synchronously", async () => {
    const closed = channel(true);
    const client = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test", channel: closed, ownsChannel: true });
    expect(client.extensions.get(GATEWAY_RAW_EXTENSION)?.getConnectionState()).toBe("error");
    await client.dispose();
    await client.dispose();
    expect(closed.close).toHaveBeenCalledTimes(1);
  });

  it("rejects pre-aborted construction without taking borrowed ownership", async () => {
    const borrowed = channel();
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: borrowed, ownsChannel: false, signal: controller.signal,
    })).rejects.toBe(controller.signal.reason);
    expect(borrowed.close).not.toHaveBeenCalled();
  });

  it("gives the dashboard token precedence over provider-neutral auth inputs", async () => {
    const headers: string[] = [];
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      headers.push(new Headers(init?.headers).get("authorization") ?? "");
      return new Response(JSON.stringify({ providers: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const resolveAuth = vi.fn(async () => ({ headers: { Authorization: "Bearer resolved" } }));
    const client = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      dashboardToken: "dashboard",
      token: "core",
      resolveAuth,
      fetch,
    });
    await client.authStatus.listAuthStatus();
    expect(headers).toEqual(["Bearer dashboard"]);
    expect(resolveAuth).not.toHaveBeenCalled();
    await client.dispose();
  });

  it("uses resolved auth ahead of the provider-neutral token when no dashboard token exists", async () => {
    let authorization = "";
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ providers: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const client = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      token: "core",
      resolveAuth: async () => ({ headers: { Authorization: "Bearer resolved" } }),
      fetch,
    });
    await client.authStatus.listAuthStatus();
    expect(authorization).toBe("Bearer resolved");
    await client.dispose();
  });

  it.each([
    ["empty", {}],
    ["unrelated", { "X-Request-Context": "runtime" }],
  ] as const)("uses the generic token when resolved %s headers contain no authentication", async (_label, resolvedHeaders) => {
    let headers = new Headers();
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ providers: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const client = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      token: "core",
      resolveAuth: async () => ({ headers: resolvedHeaders }),
      fetch,
    });
    await client.authStatus.listAuthStatus();
    expect(headers.get("authorization")).toBe("Bearer core");
    if ("X-Request-Context" in resolvedHeaders) expect(headers.get("x-request-context")).toBe("runtime");
    await client.dispose();
  });

  it.each(["", "   "])("uses the generic token when resolved authorization is blank: %j", async (authorization) => {
    let observed = "";
    const client = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", token: "core",
      resolveAuth: async () => ({ headers: { Authorization: authorization } }),
      fetch: vi.fn(async (_input, init) => {
        observed = new Headers(init?.headers).get("authorization") ?? "";
        return new Response(JSON.stringify({ providers: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }),
    });
    await client.authStatus.listAuthStatus();
    expect(observed).toBe("Bearer core");
    await client.dispose();
  });

  it("installs CAVI modules without dashboard REST configuration", async () => {
    const client = await createHermesRuntimeControlClient({ cavi: caviOptions() });
    await expect(client.tasks.listTasks({ cursor: "unsupported" })).rejects.toMatchObject({
      name: "CapabilityUnavailable",
      capability: "controlPlane.tasks.cursor",
    });
    await expect(client.workspace.listWorkspaces()).rejects.toThrow(
      /^Hermes CAVI workspace response failed schema validation$/u,
    );
    const dashboardOperations = [
      [() => client.authStatus.listAuthStatus(), "controlPlane.authStatus.list"],
      [() => client.sessions.listSessions(), "controlPlane.sessions.list"],
      [() => client.models.listModels(), "controlPlane.models.list"],
      [() => client.usage.getUsage(), "controlPlane.usage.get"],
      [() => client.events.subscribe({ operationId: "op", onEvent() {} }), "controlPlane.events.subscribe"],
    ] as const;
    for (const [invoke, capability] of dashboardOperations) {
      await expect(invoke()).rejects.toMatchObject({
        name: "CapabilityUnavailable", providerId: "hermes", capability,
      });
    }
    await client.dispose();
  });

  it("closes an owned injected channel if RPC construction fails synchronously", async () => {
    const owned = channel();
    owned.subscribeClose = vi.fn(() => {
      throw new Error("subscribe failed");
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: owned, ownsChannel: true,
    })).rejects.toThrow("subscribe failed");
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("does not close a borrowed injected channel if RPC construction fails synchronously", async () => {
    const borrowed = channel();
    borrowed.subscribeClose = vi.fn(() => {
      throw new Error("subscribe failed");
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: borrowed,
    })).rejects.toThrow("subscribe failed");
    expect(borrowed.close).not.toHaveBeenCalled();
  });

  it("unwinds an owned injected channel when abort is observed after auth", async () => {
    const owned = channel();
    const controller = new AbortController();
    const reason = new Error("post-auth abort");
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      channel: owned,
      ownsChannel: true,
      signal: controller.signal,
      resolveAuth: async () => {
        controller.abort(reason);
        return { headers: {} };
      },
    })).rejects.toBe(reason);
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("registers and closes an internally created channel before readiness", async () => {
    const internal = Object.assign(channel(), { ready: Promise.reject(new Error("not ready")) });
    webSocketConnect.mockReturnValueOnce(internal);
    await expect(createHermesRuntimeControlClient({
      dashboardWebSocketUrl: "  wss://dashboard.test/rpc?opaque=a%2Fb  ",
    })).rejects.toThrow("not ready");
    expect(webSocketConnect).toHaveBeenCalledWith(expect.objectContaining({
      url: "wss://dashboard.test/rpc?opaque=a%2Fb",
    }));
    expect(internal.close).toHaveBeenCalledTimes(1);
  });

  it("unwinds RPC ownership when abort is observed after module construction", async () => {
    const controller = new AbortController();
    const reason = new Error("post-module abort");
    const owned = channel();
    owned.subscribeClose = vi.fn((listener: (error?: unknown) => void) => {
      controller.abort(reason);
      return () => { void listener; };
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      channel: owned,
      ownsChannel: true,
      signal: controller.signal,
    })).rejects.toBe(reason);
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("does not replace a primary construction error with an owned-channel cleanup failure", async () => {
    const owned = channel();
    owned.close.mockRejectedValueOnce(new Error("secret cleanup detail"));
    owned.subscribeClose = vi.fn(() => {
      throw new Error("primary construction failure");
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: owned, ownsChannel: true,
    })).rejects.toThrow("primary construction failure");
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("bounds owned-channel cleanup failures during later disposal", async () => {
    const owned = channel();
    owned.close.mockRejectedValueOnce(new Error("secret cleanup detail"));
    const client = await createHermesRuntimeControlClient({ channel: owned, ownsChannel: true });
    await expect(client.dispose()).rejects.toThrow(/^Hermes runtime control cleanup failed$/u);
    await expect(client.dispose()).rejects.not.toThrow("secret cleanup detail");
    expect(owned.close).toHaveBeenCalledTimes(1);
  });
});

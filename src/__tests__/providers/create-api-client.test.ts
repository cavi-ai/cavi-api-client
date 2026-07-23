import { describe, expect, it, vi } from "vitest";
import { createApiClient, wireOpenClaw } from "../../providers/create-api-client.js";
import { createCapabilityClient } from "../../contracts/capability-client.js";
import { createRuntimeProviderRegistry } from "../../core/runtime/providers/registry.js";
import { getErrorStatus } from "../../core/errors.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";
import { OpenClawWebSocketClient } from "../../providers/openclaw/websocket.js";
import type { OpenClawRpcEvent } from "../../providers/openclaw/control-plane/rpc.js";
import type { RawGatewayConnectionState } from "../../core/runtime/control-plane/raw-gateway.js";

async function waitFor(predicate: () => boolean, tries = 50): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!predicate()) throw new Error("waitFor: condition not met in time");
}

/** A connection-lazy stand-in for the shared OpenClaw socket. */
class FakeSharedSocket {
  readonly eventListeners = new Set<(event: OpenClawRpcEvent) => void>();
  subscribeCalls = 0;
  request = vi.fn(async () => ({}));
  dispose = vi.fn(async () => undefined);
  connect = vi.fn(async () => undefined);
  getHelloFrame = vi.fn(() => ({}));
  getConnectionState = vi.fn((): RawGatewayConnectionState => "idle");

  subscribe(listener: (event: OpenClawRpcEvent) => void): () => void {
    this.subscribeCalls += 1;
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onConnectionState(): () => void {
    return () => undefined;
  }
}

const fakeRuntime: RuntimeClient = {
  getRuntimeCapabilities: async () => ({
    providerKind: "gemini",
    supports: { runs: true },
  }),
  startRun: async () => ({ id: "run-9", status: "queued" }) as never,
};

const geminiRegistry = createRuntimeProviderRegistry({
  modules: [{ kind: "gemini", createClient: () => fakeRuntime }],
});

const HERMES_ENVELOPE = {
  object: "hermes.api_server.capabilities",
  platform: "hermes-agent",
  model: "tony",
  features: { run_submission: true, run_events_sse: true },
  endpoints: { models: { method: "GET", path: "/v1/models" } },
  extensions: {
    plugins: {
      "cavi-control": {
        endpoints: {
          machine_media: { method: "GET", path: "/api/plugins/machine/media" },
        },
      },
    },
  },
};

describe("createApiClient — the one front door", () => {
  it("returns the full surface for a runtime-only provider; unsupported is notated", async () => {
    const client = createApiClient("gemini", { registry: geminiRegistry });
    await expect(client.startRun({} as never)).resolves.toMatchObject({
      ok: true,
      data: { id: "run-9" },
    });

    const result = await client.kanban.listBoards();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    const note = result.gap.note;
    expect(note).toContain('provider "gemini" does not support capability "kanban"');
    expect(note).toContain("hermes");
    expect(note).toContain("openclaw");
  });

  it("uses the static declarations as the fallback profile", async () => {
    const client = createApiClient("gemini", { registry: geminiRegistry });
    const map = await client.getCapabilityMap();
    // Gemini's declaration: execution only.
    expect(map.supports).toEqual({ runs: true, streaming: true, batch: true });
  });

  it("throws the standard configuration error for unknown providers", () => {
    expect(() => createApiClient("nonsense", { registry: geminiRegistry })).toThrow(
      /Unknown runtime provider/,
    );
  });

  it("auto-wires the Hermes resolver from baseUrl + token", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/capabilities")) {
        return new Response(JSON.stringify(HERMES_ENVELOPE), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = createApiClient("hermes", {
      baseUrl: "http://gateway.test",
      token: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const map = await client.getCapabilityMap();
    // Runtime resolution (media via the plugin route) merged over the static
    // gateway fallback (teams stays declared by the fallback).
    expect(map.supports.media).toBe(true);
    expect(map.supports.teams).toBe(true);
    const manifest = await client.getManifest();
    expect(manifest).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("caller-supplied backends override the auto-wiring", async () => {
    const kanban = { listBoards: vi.fn(async () => [{ id: "b9" }]) };
    const client = createApiClient("gemini", {
      registry: geminiRegistry,
      fallbackSupports: { runs: true, kanban: true },
      backends: { kanban: kanban as never },
    });
    await expect(client.kanban.listBoards()).resolves.toEqual({
      ok: true,
      source: "live",
      data: [{ id: "b9" }],
    });
  });

  it("openclaw without a socket keeps the surface but fails informatively", async () => {
    // A registry whose openclaw module needs no baseUrl isolates the wiring
    // path: no ws/baseUrl → no auto backends → supported-but-unwired is loud.
    const registry = createRuntimeProviderRegistry({
      modules: [{ kind: "openclaw", createClient: () => fakeRuntime }],
    });
    const client = createApiClient("openclaw", { registry });
    const result = await client.kanban.listBoards();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.note).toContain("no kanban backend is wired");
  });

  it("hermes streamRun without a session key resolves ok:false request-invalid and starts no run", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const client = createApiClient("hermes", {
      baseUrl: "http://gateway.test",
      fetchImpl: fetchImpl as never,
      resolver: async () => {
        throw new Error("fetch failed"); // degrade to static fallback deterministically
      },
    });
    const result = await client.streamRun({ input: "hi" }, { onEvent: () => undefined });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.reason).toBe("request-invalid");
    expect(result.gap.note).toContain("sessionKey");
    const postedRun = fetchImpl.mock.calls.some(([url, init]) =>
      String(url).includes("/runs") && (init as RequestInit | undefined)?.method === "POST");
    expect(postedRun).toBe(false);
  });

  it("hermes streamRun: SSE 500 with empty body resolves ok:false backend-unavailable (F4)", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("/runs")) {
        return new Response(JSON.stringify({ run_id: "run-1", status: "started", object: "hermes.run" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("", { status: 500 }); // SSE run-events endpoint, empty body
    });
    const client = createApiClient("hermes", {
      baseUrl: "http://gateway.test",
      token: "secret",
      fetchImpl: fetchImpl as typeof fetch,
      resolver: async () => {
        throw new Error("fetch failed"); // degrade to the static fallback deterministically
      },
    });
    const result = await client.streamRun(
      { input: "hi", sessionKey: "k" } as never,
      { onEvent: () => undefined },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.reason).toBe("backend-unavailable");
    expect(result.gap.httpStatus).toBe(500);
  });

  it("hermes streamRun: SSE 401 rejects as an auth error (F4 carve-out)", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("/runs")) {
        return new Response(JSON.stringify({ run_id: "run-1", status: "started", object: "hermes.run" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("", { status: 401 });
    });
    const client = createApiClient("hermes", {
      baseUrl: "http://gateway.test",
      token: "secret",
      fetchImpl: fetchImpl as typeof fetch,
      resolver: async () => {
        throw new Error("fetch failed");
      },
    });
    // Strengthened (M5): assert the rejection is specifically the 401 auth
    // carve-out, not merely truthy — a discriminating check on the status.
    const rejection = await client
      .streamRun({ input: "hi", sessionKey: "k" } as never, { onEvent: () => undefined })
      .then(
        () => {
          throw new Error("expected streamRun to reject with the auth error");
        },
        (error: unknown) => error,
      );
    expect(getErrorStatus(rejection)).toBe(401);
  });

  it("hermes streamRun happy path: streams SSE deltas + terminal and sends the session-key header (F12)", async () => {
    const sseBody = [
      { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, run_id: "run-1", delta: "he" },
      { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, run_id: "run-1", delta: "llo" },
      { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, run_id: "run-1", output: "hello" },
    ]
      .map((payload) => `data: ${JSON.stringify(payload)}\n\n`)
      .join("");

    let eventsHeaders: Record<string, string> | undefined;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("/runs")) {
        return new Response(
          JSON.stringify({ run_id: "run-1", status: "started", object: "hermes.run" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/events")) {
        eventsHeaders = init?.headers as Record<string, string>;
        return new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });

    const client = createApiClient("hermes", {
      baseUrl: "http://gateway.test",
      token: "secret",
      fetchImpl: fetchImpl as typeof fetch,
      resolver: async () => {
        throw new Error("fetch failed"); // degrade to the static fallback (streaming: true)
      },
    });

    const seen: RunStreamEvent[] = [];
    // No `as never` cast: the body literal with `sessionKey` typechecks via
    // StreamRunBody (F7).
    const result = await client.streamRun(
      { input: "hi", sessionKey: "sess-9" },
      { onEvent: (event) => seen.push(event) },
    );

    expect(result).toEqual({ ok: true, data: { runId: "run-1", outcome: "completed" }, source: "live" });
    expect(seen.map((event) => event.event)).toEqual([
      RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
    ]);
    // Pins the wiring: the SSE request carried the session-key header derived
    // from the run body's `sessionKey`.
    expect(eventsHeaders?.["X-Hermes-Session-Key"]).toBe("sess-9");
  });

  // F12(b) — OpenClaw's wired streamRun path is exercised by the test below
  // (bridge reached, classified without a WS server) and, at the provider level,
  // by src/__tests__/providers/openclaw/stream-run-provider.test.ts (the R9a
  // createOpenClawRunEventStreamProvider extraction). Driving a full WS handshake
  // here would require standing up a socket server, which these tests avoid.
  it("openclaw streamRun bridges over the control-plane event client", async () => {
    const client = createApiClient("openclaw", {
      baseUrl: "http://gateway.test",
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as never,
      resolver: async () => {
        throw new Error("fetch failed"); // degrade to static fallback deterministically
      },
    });
    expect(typeof client.streamRun).toBe("function");
    // The WS is unreachable in tests: the bridge's startRun/subscribe fails as
    // transport, which the facade classifies — resolves ok:false, never rejects.
    const result = await client.streamRun({ input: "hi" }, { onEvent: () => undefined });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    // the bridge was wired and reached (NOT a "does not implement" gap)
    expect(result.gap.note).not.toContain("does not implement");
    await client.dispose();
  });

  it("openclaw runs the runtime client and the wiring on ONE shared socket (R11 piece 1)", async () => {
    // Capture what the runtime client is constructed with: the shared socket is
    // injected via `rpcClient` rather than left for the client to lazily open a
    // second connection.
    let injected: unknown;
    const registry = createRuntimeProviderRegistry({
      modules: [
        {
          kind: "openclaw",
          createClient: (opts) => {
            injected = (opts as { rpcClient?: unknown }).rpcClient;
            return fakeRuntime;
          },
        },
      ],
    });
    const client = createApiClient("openclaw", {
      baseUrl: "http://gateway.test",
      registry,
    });

    // The runtime client received the real shared OpenClaw socket instance.
    expect(injected).toBeInstanceOf(OpenClawWebSocketClient);

    // The wiring holds the SAME instance: disposing the client tears down that
    // exact socket (identity proof — the wiring's onDispose targets the object
    // the runtime was injected with, so there is only one connection).
    const socket = injected as OpenClawWebSocketClient;
    const disposeSpy = vi.spyOn(socket, "dispose");
    await client.dispose();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it("openclaw shares ONE event client across concurrent streamRun calls (R11 piece 2)", async () => {
    const socket = new FakeSharedSocket();
    const runtime: RuntimeClient = {
      getRuntimeCapabilities: async () => ({
        providerKind: "openclaw",
        supports: { runs: true, streaming: true },
      }),
      startRun: async () => ({ run_id: "run-1", status: "started" }) as never,
    };
    const wiring = wireOpenClaw({ baseUrl: "http://gateway.test" }, runtime, socket as never);
    const bridge = wiring.streamRunBridge;
    if (!bridge) throw new Error("expected a wired streamRun bridge");

    // Two concurrent streams through the shared provider.
    const first = bridge({ input: "a" }, { onEvent: () => undefined });
    const second = bridge({ input: "b" }, { onEvent: () => undefined });
    await waitFor(() => socket.eventListeners.size > 0);

    // ONE native listener registration for N streams — a single event client,
    // not one per streamRun call.
    expect(socket.subscribeCalls).toBe(1);
    expect(socket.eventListeners.size).toBe(1);

    // Teardown settles both in-flight bridges (abort resolves them) and closes
    // the one socket.
    await wiring.onDispose?.();
    await Promise.all([first, second]);
    expect(socket.dispose).toHaveBeenCalledTimes(1);
  });

  it("openclaw: the wiring solely owns the shared socket — facade dispose aborts in-flight streams cleanly then closes it exactly once (R11)", async () => {
    const socket = new FakeSharedSocket();
    const runtime: RuntimeClient = {
      getRuntimeCapabilities: async () => ({
        providerKind: "openclaw",
        supports: { runs: true, streaming: true, sessions: true },
      }),
      startRun: async () => ({ run_id: "run-1", status: "started" }) as never,
    };
    const wiring = wireOpenClaw({ baseUrl: "http://gateway.test" }, runtime, socket as never);
    const client = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { runs: true, streaming: true, sessions: true },
      backends: wiring.backends,
      ...(wiring.streamRunBridge ? { streamRunBridge: wiring.streamRunBridge } : {}),
      ...(wiring.onDispose ? { onDispose: wiring.onDispose } : {}),
    });

    // Instantiate the control plane (injected rpc → no connect) so facade
    // dispose() awaits plane.dispose() BEFORE onDispose — the exact window in
    // which a socket-owning control client would close the shared socket early.
    // The call's payload parse is irrelevant; resolving the backend (setting the
    // control-plane memo) is what arms the dispose ordering.
    await client.sessions.listSessions().catch(() => undefined);

    // An in-flight streamRun: connect + subscribe succeed on the shared socket;
    // no terminal frame arrives, so it stays open until dispose aborts it.
    let settled = false;
    const streaming = client
      .streamRun({ input: "hi" }, { onEvent: () => undefined })
      .then((result) => {
        settled = true;
        return result;
      });
    await waitFor(() => socket.eventListeners.size > 0);
    expect(settled).toBe(false);

    await client.dispose();
    const result = await streaming;

    // Clean abort settle (R10 dispose semantics) — NOT an F1 connection-error
    // gap from the socket being closed out from under the live stream.
    expect(result).toEqual({ ok: true, data: { runId: null, outcome: null }, source: "live" });
    // Closed exactly once, by onDispose. The control client (takeRpcOwnership
    // false) never closes the socket it does not own.
    expect(socket.dispose).toHaveBeenCalledTimes(1);
  });
});

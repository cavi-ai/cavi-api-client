import { describe, expect, it, vi } from "vitest";

import {
  createRuntimeControlClient,
  type RuntimeControlClient,
} from "../../index.js";
import { CapabilityUnavailable } from "../../core/runtime/control-plane/runtime-control-client.js";
import { runRuntimeControlClientConformance } from "../../testing/index.js";
import { createBuiltInRuntimeProviderRegistry } from "../../providers/runtime-provider-registry.js";
import { withCaviRuntimeControlProviders } from "../../extensions/cavi/providers/runtime-control-registry.js";

const modules = ["authStatus", "sessions", "models", "usage", "tasks", "workspace", "events"];

function unavailableHarness(
  providerId: string,
  error: CapabilityUnavailable,
) {
  return {
    providerId,
    create: async () => {
      const plane = await createRuntimeControlClient(providerId);
      return {
        ...plane,
        sessions: {
          ...plane.sessions,
          listSessions: () => Promise.reject(error),
        },
      };
    },
  };
}

function fixtureTransport() {
  const payloads: Record<string, unknown> = {
    "models.authStatus": { ts: 1_760_000_000_000, providers: [] },
    "models.list": { models: [{ id: "model-1", name: "Model One", provider: "openclaw" }] },
    "sessions.list": { ts: 1_760_000_000_000, count: 1, defaults: {}, sessions: [{ key: "session-1" }] },
    "sessions.describe": { session: { key: "session-1" } },
    "sessions.abort": { ok: true, abortedRunId: "run-1", status: "aborted" },
    "usage.status": { updatedAt: 1_760_000_000_000, providers: [] },
    "usage.cost": { updatedAt: 1_760_000_000_000, days: 1, totals: { input: 1, output: 2, totalTokens: 3, cacheRead: 0, cacheWrite: 0, missingCostEntries: 0, totalCost: 0.01 }, daily: [] },
    "tasks.list": { tasks: [{ id: "task-1", status: "running" }] },
    "tasks.get": { task: { id: "task-1", status: "running" } },
    "tasks.cancel": { found: true, cancelled: true, task: { id: "task-1", status: "cancelled" } },
    "agents.list": { defaultId: "agent-1", mainKey: "main", scope: "per-sender", agents: [{ id: "agent-1", name: "Workspace One", workspace: "workspace-1" }] },
  };
  return {
    request: vi.fn(async (method: string) => payloads[method]),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("canonical control-plane conformance", () => {
  it("uses the public factory, built-in OpenClaw registration, and provider-neutral transport seam", async () => {
    const transport = fixtureTransport();
    const abortReason = new Error("stop OpenClaw request");
    const report = await runRuntimeControlClientConformance({
      providerId: "openclaw",
      create: () => createRuntimeControlClient("open-claw", { transport }),
      lifecycle: {
        abortReason,
        inFlightAbort: async (signal) => {
          const abortingTransport = {
            ...fixtureTransport(),
            request: vi.fn((_method: string, _params: unknown, options?: { signal?: AbortSignal }) =>
              new Promise((_resolve, reject) => options?.signal?.addEventListener(
                "abort", () => reject(options.signal?.reason), { once: true },
              ))),
          };
          const client = await createRuntimeControlClient("openclaw", { transport: abortingTransport });
          return { operation: client.sessions.listSessions({ signal }), cleanup: () => client.dispose() };
        },
        ownership: {
          borrowed: async () => {
            const rpc = fixtureTransport();
            const client = await createRuntimeControlClient("openclaw", { transport: rpc });
            return { dispose: () => client.dispose(), releases: () => rpc.dispose.mock.calls.length };
          },
          owned: async () => {
            const rpc = fixtureTransport();
            const options = { transport: rpc, takeRpcOwnership: true };
            const client = await createRuntimeControlClient("openclaw", options);
            return { dispose: () => client.dispose(), releases: () => rpc.dispose.mock.calls.length };
          },
        },
      },
    });

    expect(report, JSON.stringify(report)).toMatchObject({ valid: true, modules });
    expect(report.supported).toEqual(expect.arrayContaining([
      "authStatus.listAuthStatus", "sessions.listSessions", "sessions.getSession",
      "sessions.cancelSession", "models.listModels", "usage.getUsage", "tasks.listTasks",
      "tasks.getTask", "tasks.cancelTask", "workspace.listWorkspaces",
      "workspace.getWorkspace", "events.subscribe",
    ]));
    expect(transport.request).toHaveBeenCalledWith("models.list", { view: "configured" }, { signal: undefined });
  });

  it.each(["claude", "codex", "gemini", "unknown"])(
    "validates the shipped/default unavailable path for %s",
    async (providerId) => {
      const report = await runRuntimeControlClientConformance({
        providerId,
        create: () => createRuntimeControlClient(providerId),
      });
      expect(report).toMatchObject({ valid: true, modules, supported: [] });
      expect(report.unavailable).toHaveLength(12);

      const plane = await createRuntimeControlClient(providerId);
      try {
        await expect(plane.sessions.listSessions()).rejects.toMatchObject<CapabilityUnavailable>({
          name: "CapabilityUnavailable",
          providerId,
          capability: "controlPlane.sessions.list",
        });
      } finally {
        await plane.dispose();
      }
    },
  );

  it("validates partially configured Hermes without promoting plugin-gated modules", async () => {
    const abortReason = new Error("stop Hermes construction");
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      const payloads: Record<string, unknown> = {
        "/api/provider-auth": { providers: [] },
        "/api/models": { providers: [{ slug: "fixture", name: "Fixture", models: ["model-1"], total_models: 1, is_current: true, is_user_defined: false, source: "built-in" }], model: "model-1", provider: "fixture" },
        "/api/analytics/usage": {
          daily: [], by_model: [], period_days: 1,
          totals: { total_input: 0, total_output: 0, total_cache_read: 0, total_reasoning: 0, total_estimated_cost: 0, total_actual_cost: 0, total_sessions: 0, total_api_calls: 0 },
          skills: { summary: { total_skill_loads: 0, total_skill_edits: 0, total_skill_actions: 0, distinct_skills_used: 0 }, top_skills: [] },
        },
      };
      return new Response(JSON.stringify(payloads[path]), {
        status: path in payloads ? 200 : 404,
        headers: { "content-type": "application/json" },
      });
    });
    const registry = withCaviRuntimeControlProviders(createBuiltInRuntimeProviderRegistry(), {
      hermes: { dashboardBaseUrl: "https://dashboard.test", fetch },
    });
    const report = await runRuntimeControlClientConformance({
      providerId: "hermes",
      create: () => createRuntimeControlClient("hermes", { registry }),
      lifecycle: {
        abortReason: abortReason,
        preAbort: async (signal) => {
          const abortRegistry = withCaviRuntimeControlProviders(createBuiltInRuntimeProviderRegistry(), {
            hermes: { dashboardBaseUrl: "https://dashboard.test", fetch },
          });
          return createRuntimeControlClient("hermes", { registry: abortRegistry, signal });
        },
      },
    });
    expect(report, JSON.stringify(report)).toMatchObject({ valid: true, modules });
    expect(report.supported).toEqual([
      "authStatus.listAuthStatus", "models.listModels", "usage.getUsage",
    ]);
    expect(report.unavailable).toHaveLength(9);
  });

  it("lets one consumer use OpenClaw and unavailable providers without branching", async () => {
    const renderSessions = async (plane: RuntimeControlClient) => {
      try { return (await plane.sessions.listSessions()).data.map((item) => item.id); }
      catch (error) { return error instanceof CapabilityUnavailable ? ["unavailable"] : Promise.reject(error); }
      finally { await plane.dispose(); }
    };

    await expect(renderSessions(await createRuntimeControlClient("openclaw", { transport: fixtureTransport() })))
      .resolves.toEqual(["session-1"]);
    for (const provider of ["claude", "codex", "gemini", "unknown"]) {
      await expect(renderSessions(await createRuntimeControlClient(provider))).resolves.toEqual(["unavailable"]);
    }
  });

  it("rejects empty modules and non-function methods", async () => {
    const empty = Object.fromEntries(modules.map((name) => [name, {}]));
    const report = await runRuntimeControlClientConformance({
      providerId: "fixture",
      create: async () => ({
        ...empty,
        dispose: async () => undefined,
      } as unknown as RuntimeControlClient),
    });
    expect(report.valid).toBe(false);
    expect(report.failures).toEqual(expect.arrayContaining([
      "authStatus.listAuthStatus must be a function",
      "events.subscribe must be a function",
    ]));
  });

  it("rejects CapabilityUnavailable from the wrong provider", async () => {
    const report = await runRuntimeControlClientConformance(
      unavailableHarness(
        "claude",
        new CapabilityUnavailable("codex", "controlPlane.sessions.list"),
      ),
    );

    expect(report.valid).toBe(false);
    expect(report.unavailable).not.toContain("sessions.listSessions");
    expect(report.failures).toContain(
      "sessions.listSessions rejected for provider codex; expected claude",
    );
  });

  it("rejects CapabilityUnavailable with the wrong operation capability", async () => {
    const report = await runRuntimeControlClientConformance(
      unavailableHarness(
        "claude",
        new CapabilityUnavailable("claude", "controlPlane.sessions.get"),
      ),
    );

    expect(report.valid).toBe(false);
    expect(report.unavailable).not.toContain("sessions.listSessions");
    expect(report.failures).toContain(
      "sessions.listSessions rejected with capability controlPlane.sessions.get; expected controlPlane.sessions.list",
    );
  });

  it("rejects unavailable errors whose exact canonical message was changed", async () => {
    const error = new CapabilityUnavailable("claude", "controlPlane.sessions.list");
    error.message = "session list failed";
    const report = await runRuntimeControlClientConformance(unavailableHarness("claude", error));
    expect(report.valid).toBe(false);
    expect(report.failures).toContain(
      "sessions.listSessions rejected with message session list failed; expected controlPlane.sessions.list is unavailable for provider claude",
    );
  });

  it("rejects errors that expose configured secret material", async () => {
    const report = await runRuntimeControlClientConformance({
      ...unavailableHarness("claude", new Error("request failed with Bearer top-secret") as CapabilityUnavailable),
      secrets: ["top-secret"],
    });
    expect(report.valid).toBe(false);
    expect(report.failures).toContain("sessions.listSessions exposed configured secret material");
  });

  it("verifies subscriptions and clients have idempotent disposal", async () => {
    let subscriptionDisposals = 0;
    let clientDisposals = 0;
    const transport = fixtureTransport();
    const report = await runRuntimeControlClientConformance({
      providerId: "openclaw",
      create: async () => {
        const client = await createRuntimeControlClient("openclaw", { transport });
        return {
          ...client,
          events: {
            subscribe: async () => ({
              dispose: async () => {
                subscriptionDisposals += 1;
                if (subscriptionDisposals > 1) throw new Error("subscription disposed twice");
              },
            }),
          },
          dispose: async () => {
            clientDisposals += 1;
            if (clientDisposals > 1) throw new Error("client disposed twice");
          },
        };
      },
    });
    expect(report.valid).toBe(false);
    expect(report.failures).toEqual(expect.arrayContaining([
      "events.subscribe disposal is not idempotent",
      "dispose is not idempotent",
    ]));
  });

  it("rejects abort probes that do not preserve the exact abort reason and always cleans up", async () => {
    const reason = new Error("abort-fixture");
    const cleanup = vi.fn(async () => undefined);
    const report = await runRuntimeControlClientConformance({
      providerId: "openclaw",
      create: () => createRuntimeControlClient("openclaw", { transport: fixtureTransport() }),
      lifecycle: {
        abortReason: reason,
        preAbort: async () => Promise.reject(new Error("wrong abort")),
        inFlightAbort: async () => ({ operation: Promise.reject(new Error("wrong abort")), cleanup }),
      },
    });
    expect(report.valid).toBe(false);
    expect(report.failures).toEqual(expect.arrayContaining([
      "pre-aborted construction did not reject with the abort reason",
      "in-flight operation did not reject with the abort reason",
    ]));
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("rejects ownership probes that release borrowed resources or leak owned resources", async () => {
    const borrowed = { releases: 0 };
    const owned = { releases: 0 };
    const report = await runRuntimeControlClientConformance({
      providerId: "claude",
      create: () => createRuntimeControlClient("claude"),
      lifecycle: {
        ownership: {
          borrowed: async () => ({ dispose: async () => { borrowed.releases += 1; }, releases: () => borrowed.releases }),
          owned: async () => ({ dispose: async () => undefined, releases: () => owned.releases }),
        },
      },
    });
    expect(report.valid).toBe(false);
    expect(report.failures).toEqual(expect.arrayContaining([
      "borrowed resource was released by client disposal",
      "owned resource was not released exactly once",
    ]));
  });

  it("disposes a client unexpectedly returned by a pre-abort probe", async () => {
    const returned = await createRuntimeControlClient("claude");
    const dispose = vi.spyOn(returned, "dispose");
    const report = await runRuntimeControlClientConformance({
      providerId: "claude",
      create: () => createRuntimeControlClient("claude"),
      lifecycle: { preAbort: async () => returned },
    });
    expect(report.valid).toBe(false);
    expect(report.failures).toContain("pre-aborted construction did not reject with the abort reason");
    expect(dispose).toHaveBeenCalledOnce();
  });
});

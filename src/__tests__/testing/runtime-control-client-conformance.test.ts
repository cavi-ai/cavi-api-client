import { describe, expect, it, vi } from "vitest";

import {
  createRuntimeControlClient,
  type RuntimeControlClient,
} from "../../index.js";
import { CapabilityUnavailable } from "../../core/runtime/control-plane/runtime-control-client.js";
import { runRuntimeControlClientConformance } from "../../testing/index.js";

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
    const report = await runRuntimeControlClientConformance({
      providerId: "openclaw",
      create: () => createRuntimeControlClient("open-claw", { transport }),
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
});

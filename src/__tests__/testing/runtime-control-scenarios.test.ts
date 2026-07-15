import { describe, expect, it, vi } from "vitest";

import type { RuntimeControlClient } from "../../core/runtime/control-plane/runtime-control-client.js";
import { CapabilityUnavailable } from "../../core/runtime/control-plane/runtime-control-client.js";
import { createRuntimeControlExtensionRegistry } from "../../core/runtime/control-plane/extensions.js";
import {
  RUNTIME_CONTROL_SCENARIO_EXTENSION,
  RUNTIME_CONTROL_SCENARIOS,
  runRuntimeControlScenarios,
} from "../../testing/runtime-control-scenarios.js";

function fixtureClient(overrides: Partial<RuntimeControlClient> = {}): RuntimeControlClient {
  const metadata = { provider: "fixture", stability: "stable" as const, source: { transport: "http" as const, method: "fixture" } };
  return {
    authStatus: { listAuthStatus: async () => [] },
    models: { listModels: async () => ({ data: [] }) },
    sessions: {
      listSessions: async ({ signal } = {}) => {
        if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
        return { data: [{ id: "session-1", providerId: "fixture", state: "active", providerKind: "fixture", metadata }] };
      },
      getSession: async (id) => ({ id, providerId: "fixture", state: "active", providerKind: "fixture", metadata }),
    },
    usage: { getUsage: async () => ({ tokens: { input: 0, output: 0, total: 0 }, cost: { availability: "unavailable" }, metadata }) },
    tasks: {
      listTasks: async () => ({ data: [{ id: "task-1", state: "running", metadata }] }),
      getTask: async (id) => ({ id, state: "running", metadata }),
    },
    workspace: {
      listWorkspaces: async () => [{ id: "workspace-1", providerId: "fixture", accessMode: "read-only", metadata }],
      getWorkspace: async (id) => ({ id, providerId: "fixture", accessMode: "read-only", metadata }),
    },
    events: { subscribe: async () => ({ dispose: () => undefined }) },
    extensions: createRuntimeControlExtensionRegistry(),
    dispose: async () => undefined,
    ...overrides,
  };
}

describe("runtime-control scenario catalog", () => {
  it("keeps scenario IDs unique and stable across the required behavior groups", () => {
    const ids = RUNTIME_CONTROL_SCENARIOS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "auth.status", "models.list", "sessions.list", "sessions.get", "usage.get",
      "tasks.list", "tasks.get", "workspace.list", "workspace.get", "events.subscribe",
      "extensions.discovery", "abort.preflight", "pagination.sessions", "disposal.cleanup",
      "provenance.sessions", "disposal.client",
    ]);
  });

  it("does not call mutation hooks or resource-prefix generation in read-only mode", async () => {
    const mutate = vi.fn();
    const createResourcePrefix = vi.fn(() => "cavi-sync-test-20260715-fixture");
    const client = fixtureClient({
      extensions: createRuntimeControlExtensionRegistry([[RUNTIME_CONTROL_SCENARIO_EXTENSION, { createDisposableResources: mutate }]]),
    });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "read-only", createResourcePrefix });

    expect(result.failures).toEqual([]);
    expect(mutate).not.toHaveBeenCalled();
    expect(createResourcePrefix).not.toHaveBeenCalled();
    expect(result.scenarios.find(({ id }) => id === "disposal.cleanup")?.status).toBe("skipped");
  });

  it("records typed unavailable capabilities without failing the run", async () => {
    const client = fixtureClient({
      sessions: {
        listSessions: async () => { throw new CapabilityUnavailable("fixture", "controlPlane.sessions.list"); },
        getSession: async () => { throw new CapabilityUnavailable("fixture", "controlPlane.sessions.get"); },
      },
    });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "read-only", createResourcePrefix: () => "unused" });

    expect(result.failures).toEqual([]);
    expect(result.scenarios.find(({ id }) => id === "sessions.list")).toMatchObject({ status: "unavailable", detail: "controlPlane.sessions.list" });
  });

  it("registers and runs disposable cleanup and always disposes the client", async () => {
    const cleanups: string[] = [];
    const dispose = vi.fn(async () => undefined);
    const client = fixtureClient({
      extensions: createRuntimeControlExtensionRegistry([[
        RUNTIME_CONTROL_SCENARIO_EXTENSION,
        { createDisposableResources: async (prefix: string) => [{ cleanup: async () => { cleanups.push(prefix); } }] },
      ]]),
      dispose,
    });

    const result = await runRuntimeControlScenarios({
      createClient: async () => client,
      mutationMode: "disposable",
      createResourcePrefix: () => "cavi-sync-test-20260715-fixture",
    });

    expect(result.failures).toEqual([]);
    expect(result.scenarios.map(({ id }) => id)).toContain("sessions.list");
    expect(cleanups).toEqual(["cavi-sync-test-20260715-fixture"]);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("reports cleanup and client-disposal failures without exposing error messages", async () => {
    const client = fixtureClient({
      extensions: createRuntimeControlExtensionRegistry([[
        RUNTIME_CONTROL_SCENARIO_EXTENSION,
        { createDisposableResources: async () => [{ cleanup: async () => { throw new Error("Bearer top-secret"); } }] },
      ]]),
      dispose: async () => { throw new Error("token=top-secret"); },
    });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "disposable", createResourcePrefix: () => "cavi-sync-test-20260715-fixture" });

    expect(result.failures).toEqual(["disposal.cleanup", "disposal.client"]);
    expect(JSON.stringify(result)).not.toContain("top-secret");
  });

  it("records ordinary abort failures as redacted failures", async () => {
    const client = fixtureClient({
      sessions: {
        ...fixtureClient().sessions,
        listSessions: async ({ signal } = {}) => {
          if (signal?.aborted) throw new Error("Authorization: Bearer top-secret");
          return { data: [] };
        },
      },
    });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "read-only", createResourcePrefix: () => "unused" });

    expect(result.scenarios.find(({ id }) => id === "abort.preflight")).toMatchObject({ status: "failed", detail: "operation-failed" });
    expect(result.failures).toContain("abort.preflight");
    expect(JSON.stringify(result)).not.toContain("top-secret");
  });

  it("passes canonical AbortError and records typed abort unavailability", async () => {
    const aborting = fixtureClient({
      sessions: {
        ...fixtureClient().sessions,
        listSessions: async ({ signal } = {}) => {
          if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
          return { data: [] };
        },
      },
    });
    const unavailable = fixtureClient({
      sessions: {
        ...fixtureClient().sessions,
        listSessions: async ({ signal } = {}) => {
          if (signal?.aborted) throw new CapabilityUnavailable("fixture", "controlPlane.sessions.list.abort");
          return { data: [] };
        },
      },
    });

    const passed = await runRuntimeControlScenarios({ createClient: () => aborting, mutationMode: "read-only", createResourcePrefix: () => "unused" });
    const absent = await runRuntimeControlScenarios({ createClient: () => unavailable, mutationMode: "read-only", createResourcePrefix: () => "unused" });

    expect(passed.scenarios.find(({ id }) => id === "abort.preflight")).toMatchObject({ status: "passed" });
    expect(absent.scenarios.find(({ id }) => id === "abort.preflight")).toMatchObject({ status: "unavailable", detail: "controlPlane.sessions.list.abort" });
  });

  it("fails when a provider ignores a pre-aborted session-list signal", async () => {
    const client = fixtureClient({ sessions: {
      ...fixtureClient().sessions,
      listSessions: async () => ({ data: [] }),
    } });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "read-only", createResourcePrefix: () => "unused" });

    expect(result.scenarios.find(({ id }) => id === "abort.preflight")).toMatchObject({ status: "failed", detail: "invalid-result" });
    expect(result.failures).toContain("abort.preflight");
  });

  it("skips every dependent probe when its provider-neutral prerequisite is absent", async () => {
    const client = fixtureClient({
      sessions: { ...fixtureClient().sessions, listSessions: async () => ({ data: [] }) },
      tasks: { ...fixtureClient().tasks, listTasks: async () => ({ data: [] }) },
      workspace: { ...fixtureClient().workspace, listWorkspaces: async () => [] },
    });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "read-only", createResourcePrefix: () => "unused" });

    for (const id of ["sessions.get", "tasks.get", "workspace.get", "pagination.sessions", "provenance.sessions"]) {
      expect(result.scenarios.find((row) => row.id === id)).toMatchObject({ status: "skipped", detail: "prerequisite-missing" });
    }
  });

  it.each(["cavi-sync-test-x", "cavi-sync-test-20260715-", "cavi-sync-test-20261340-fixture", "other-20260715-fixture"])(
    "rejects malformed disposable name %s before mutation",
    async (prefix) => {
      const mutate = vi.fn();
      const client = fixtureClient({ extensions: createRuntimeControlExtensionRegistry([[
        RUNTIME_CONTROL_SCENARIO_EXTENSION, { createDisposableResources: mutate },
      ]]) });

      const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "disposable", createResourcePrefix: () => prefix });

      expect(mutate).not.toHaveBeenCalled();
      expect(result.scenarios.find(({ id }) => id === "disposal.cleanup")).toMatchObject({ status: "failed", detail: "invalid-result" });
    },
  );

  it("cleans multiple resources in reverse order after a later scenario fails", async () => {
    const calls: string[] = [];
    const client = fixtureClient({
      sessions: {
        ...fixtureClient().sessions,
        listSessions: async ({ signal } = {}) => signal?.aborted
          ? { data: [] }
          : { data: [{ id: "session-1", providerId: "fixture", state: "active", providerKind: "fixture", metadata: { provider: "fixture", stability: "stable", source: { transport: "http", method: "" } } }] },
      },
      extensions: createRuntimeControlExtensionRegistry([[
        RUNTIME_CONTROL_SCENARIO_EXTENSION,
        { createDisposableResources: async () => [
          { cleanup: async () => { calls.push("first"); } },
          { cleanup: async () => { calls.push("second"); } },
        ] },
      ]]),
      dispose: async () => { calls.push("dispose"); },
    });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "disposable", createResourcePrefix: () => "cavi-sync-test-20260715-fixture" });

    expect(result.failures).toContain("provenance.sessions");
    expect(calls).toEqual(["second", "first", "dispose"]);
  });

  it("fails an empty disposable mutation result", async () => {
    const client = fixtureClient({ extensions: createRuntimeControlExtensionRegistry([[
      RUNTIME_CONTROL_SCENARIO_EXTENSION, { createDisposableResources: async () => [] },
    ]]) });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "disposable", createResourcePrefix: () => "cavi-sync-test-20260715-fixture" });

    expect(result.scenarios.find(({ id }) => id === "disposal.cleanup")).toMatchObject({ status: "failed", detail: "invalid-result" });
  });

  it("registers all callable cleanups around malformed resources and cleans them in reverse", async () => {
    const calls: string[] = [];
    const client = fixtureClient({
      extensions: createRuntimeControlExtensionRegistry([[
        RUNTIME_CONTROL_SCENARIO_EXTENSION,
        { createDisposableResources: async () => [
          { cleanup: async () => { calls.push("first"); } },
          { cleanup: "malformed" },
          { cleanup: async () => { calls.push("third"); } },
        ] as never },
      ]]),
    });

    const result = await runRuntimeControlScenarios({ createClient: () => client, mutationMode: "disposable", createResourcePrefix: () => "cavi-sync-test-20260715-fixture" });

    expect(result.scenarios.find(({ id }) => id === "disposal.cleanup")).toMatchObject({ status: "failed", detail: "invalid-result" });
    expect(calls).toEqual(["third", "first"]);
  });
});

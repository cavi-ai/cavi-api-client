import { describe, expect, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { createRuntimeControlClient } from "../../../../providers/runtime-control-client-factory.js";
import { createBuiltInRuntimeProviderRegistry } from "../../../../providers/runtime-provider-registry.js";
import { withCaviRuntimeControlProviders } from "../../../../extensions/cavi/providers/runtime-control-registry.js";

const fixtureTransport = () => ({
  request: vi.fn(async (method: string) => ({
    "sessions.list": { ts: 1_760_000_000_000, count: 0, defaults: {}, sessions: [] },
  })[method]),
  subscribe: vi.fn(() => () => undefined),
  dispose: vi.fn(async () => undefined),
});

async function consume(providerId: string, registry: ReturnType<typeof withCaviRuntimeControlProviders>) {
  const options = providerId === "openclaw" || providerId === "open-claw"
    ? { registry, transport: fixtureTransport() }
    : { registry };
  const client: RuntimeControlClient = await createRuntimeControlClient(providerId, options);
  try {
    return await client.sessions.listSessions();
  } finally {
    await client.dispose();
  }
}

describe("CAVI runtime-control registry real integration", () => {
  it("returns exact complete unavailable Hermes behavior with real composition and missing config", async () => {
    const registry = withCaviRuntimeControlProviders(createBuiltInRuntimeProviderRegistry());
    const client = await createRuntimeControlClient("hermes-api-server", { registry });

    expect(Object.keys(client).sort()).toEqual([
      "authStatus", "dispose", "events", "models", "sessions", "tasks", "usage", "workspace",
    ]);
    const unavailableCalls: Array<[string, () => Promise<unknown>]> = [
      ["controlPlane.authStatus.list", () => client.authStatus.listAuthStatus()],
      ["controlPlane.sessions.list", () => client.sessions.listSessions()],
      ["controlPlane.sessions.get", () => client.sessions.getSession("session-1")],
      ["controlPlane.sessions.cancel", () => client.sessions.cancelSession("session-1")],
      ["controlPlane.models.list", () => client.models.listModels()],
      ["controlPlane.usage.get", () => client.usage.getUsage()],
      ["controlPlane.tasks.list", () => client.tasks.listTasks()],
      ["controlPlane.tasks.get", () => client.tasks.getTask("task-1")],
      ["controlPlane.tasks.cancel", () => client.tasks.cancelTask("task-1")],
      ["controlPlane.workspace.list", () => client.workspace.listWorkspaces()],
      ["controlPlane.workspace.get", () => client.workspace.getWorkspace("workspace-1")],
      ["controlPlane.events.subscribe", () => client.events.subscribe({ onEvent: () => undefined })],
    ];
    for (const [capability, call] of unavailableCalls) {
      await expect(call()).rejects.toEqual(new CapabilityUnavailable("hermes", capability));
    }
    await client.dispose();
  });

  it("uses one no-switch consumer for built-in providers, aliases, and unavailable providers", async () => {
    const registry = withCaviRuntimeControlProviders(createBuiltInRuntimeProviderRegistry());
    await expect(consume("openclaw", registry)).resolves.toMatchObject({ data: [] });
    await expect(consume("open-claw", registry)).resolves.toMatchObject({ data: [] });
    for (const provider of ["hermes", "hermes-api-server", "codex", "claude", "gemini", "unknown"]) {
      await expect(consume(provider, registry)).rejects.toBeInstanceOf(CapabilityUnavailable);
    }
  });
});

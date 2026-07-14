import { describe, expect, expectTypeOf, it } from "vitest";
import {
  CapabilityUnavailable,
  createUnavailableCanonicalControlPlane,
  type CanonicalControlPlaneOptions,
  type CanonicalRuntimeControlPlane,
  type RuntimeControlPlane,
} from "../../../../core/runtime/index";

describe("canonical runtime control plane", () => {
  it("always exposes every required control-plane surface", () => {
    const plane = createUnavailableCanonicalControlPlane("gemini", new Set());

    expect(Object.keys(plane)).toEqual(expect.arrayContaining([
      "authStatus",
      "sessions",
      "models",
      "usage",
      "tasks",
      "workspace",
      "events",
      "dispose",
    ]));
    expectTypeOf(plane).toEqualTypeOf<CanonicalRuntimeControlPlane>();
    expectTypeOf<RuntimeControlPlane>().toBeObject();
    expectTypeOf<CanonicalControlPlaneOptions>().toBeObject();
  });

  it("rejects every client method with its typed capability name", async () => {
    const plane = createUnavailableCanonicalControlPlane("gemini", new Set());
    const calls: ReadonlyArray<[string, () => Promise<unknown>]> = [
      ["controlPlane.authStatus.list", () => plane.authStatus.listAuthStatus()],
      ["controlPlane.sessions.list", () => plane.sessions.listSessions({})],
      ["controlPlane.sessions.get", () => plane.sessions.getSession("session-1")],
      ["controlPlane.sessions.cancel", () => plane.sessions.cancelSession!("session-1")],
      ["controlPlane.models.list", () => plane.models.listModels({})],
      ["controlPlane.usage.get", () => plane.usage.getUsage({})],
      ["controlPlane.tasks.list", () => plane.tasks.listTasks({})],
      ["controlPlane.tasks.get", () => plane.tasks.getTask("task-1")],
      ["controlPlane.tasks.cancel", () => plane.tasks.cancelTask!("task-1")],
      ["controlPlane.workspace.list", () => plane.workspace.listWorkspaces()],
      ["controlPlane.workspace.get", () => plane.workspace.getWorkspace("workspace-1")],
      ["controlPlane.events.subscribe", () => plane.events.subscribe(
        { operationId: "operation-1" },
        { onEvent: () => undefined },
      )],
    ];

    for (const [capability, call] of calls) {
      await expect(call()).rejects.toMatchObject({
        name: "CapabilityUnavailable",
        providerId: "gemini",
        capability,
      });
    }
  });

  it("creates a fresh CapabilityUnavailable for every rejection", async () => {
    const plane = createUnavailableCanonicalControlPlane("gemini", new Set());
    const first = await plane.sessions.listSessions({}).catch((error: unknown) => error);
    const second = await plane.sessions.listSessions({}).catch((error: unknown) => error);

    expect(first).toBeInstanceOf(CapabilityUnavailable);
    expect(second).toBeInstanceOf(CapabilityUnavailable);
    expect(first).not.toBe(second);
  });

  it("has an idempotent side-effect-free dispose", async () => {
    const plane = createUnavailableCanonicalControlPlane("gemini", new Set());

    await expect(plane.dispose()).resolves.toBeUndefined();
    await expect(plane.dispose()).resolves.toBeUndefined();
  });
});

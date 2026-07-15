import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createRuntimeControlExtensionRegistry,
  defineRuntimeControlExtension,
  withRuntimeControlExtensions,
  type RuntimeControlExtensionDescriptor,
} from "../../../../core/runtime/control-plane/extensions.js";
import { createUnavailableRuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";

describe("runtime control extensions", () => {
  it("provides immutable typed lookup with sorted normalized IDs", () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>(" fixture.alpha ");
    const zeta = defineRuntimeControlExtension<{ value: number }>("fixture.zeta");
    const registry = createRuntimeControlExtensionRegistry([
      [zeta, { value: 7 }],
      [alpha, { read: () => "alpha" }],
    ]);

    expect(alpha.id).toBe("fixture.alpha");
    expect(Object.isFrozen(alpha)).toBe(true);
    expect(registry.has(alpha)).toBe(true);
    expect(registry.get(alpha)?.read()).toBe("alpha");
    expect(registry.get(zeta)?.value).toBe(7);
    expect(registry.list()).toEqual(["fixture.alpha", "fixture.zeta"]);
    expect(Object.isFrozen(registry.list())).toBe(true);
    expect(Object.isFrozen(registry)).toBe(true);
    expectTypeOf(registry.get(alpha)).toEqualTypeOf<{ read(): string } | undefined>();
  });

  it("returns absence without throwing", () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const registry = createRuntimeControlExtensionRegistry();

    expect(registry.has(alpha)).toBe(false);
    expect(registry.get(alpha)).toBeUndefined();
    expect(registry.list()).toEqual([]);
  });

  it("keys typed lookup by exact descriptor identity, not ID text", () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const wrongType = defineRuntimeControlExtension<{ count: number }>(" fixture.alpha ");
    const registry = createRuntimeControlExtensionRegistry([
      [alpha, { read: () => "alpha" }],
    ]);

    expect(registry.has(wrongType)).toBe(false);
    expect(registry.get(wrongType)).toBeUndefined();
    expect(registry.get(alpha)?.read()).toBe("alpha");
  });

  it("rejects blank and duplicate normalized IDs", () => {
    expect(() => defineRuntimeControlExtension("   ")).toThrow(
      "Runtime-control extension ID must not be blank",
    );

    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const duplicate = defineRuntimeControlExtension<{ read(): string }>(" fixture.alpha ");
    expect(() => createRuntimeControlExtensionRegistry([
      [alpha, { read: () => "one" }],
      [duplicate, { read: () => "two" }],
    ])).toThrow("Duplicate runtime-control extension: fixture.alpha");
  });

  it.each([
    "authStatus",
    "sessions",
    "models",
    "usage",
    "tasks",
    "workspace",
    "events",
    "extensions",
    "dispose",
  ])("rejects the reserved core ID %s", (id) => {
    expect(() => defineRuntimeControlExtension(` ${id} `)).toThrow(
      `Reserved runtime-control extension ID: ${id}`,
    );
    expect(() => createRuntimeControlExtensionRegistry([
      [{ id: ` ${id} ` }, {}],
    ])).toThrow(`Reserved runtime-control extension ID: ${id}`);
  });

  it("snapshots entries during construction", () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const entries: Array<readonly [RuntimeControlExtensionDescriptor<unknown>, unknown]> = [
      [alpha, { read: () => "alpha" }],
    ];
    const registry = createRuntimeControlExtensionRegistry(entries);

    entries.length = 0;

    expect(registry.get(alpha)?.read()).toBe("alpha");
    expect(registry.list()).toEqual(["fixture.alpha"]);
  });

  it("preserves module identities and delegates disposal exactly once", async () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const client = createUnavailableRuntimeControlClient("fixture", new Set());
    const dispose = vi.spyOn(client, "dispose");
    const extended = withRuntimeControlExtensions(client, [
      [alpha, { read: () => "alpha" }],
    ]);

    expect(Object.isFrozen(extended)).toBe(true);
    expect(extended).not.toBe(client);
    expect(extended.authStatus).toBe(client.authStatus);
    expect(extended.sessions).toBe(client.sessions);
    expect(extended.models).toBe(client.models);
    expect(extended.usage).toBe(client.usage);
    expect(extended.tasks).toBe(client.tasks);
    expect(extended.workspace).toBe(client.workspace);
    expect(extended.events).toBe(client.events);
    expect(extended.extensions.get(alpha)?.read()).toBe("alpha");

    await extended.dispose();
    await extended.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("composes repeated enhancers without replacing existing extensions", () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const zeta = defineRuntimeControlExtension<{ count: number }>("fixture.zeta");
    const client = createUnavailableRuntimeControlClient("fixture", new Set());
    const first = withRuntimeControlExtensions(client, [[alpha, { read: () => "alpha" }]]);
    const second = withRuntimeControlExtensions(first, [[zeta, { count: 7 }]]);

    expect(second.extensions.get(alpha)?.read()).toBe("alpha");
    expect(second.extensions.get(zeta)?.count).toBe(7);
    expect(second.extensions.list()).toEqual(["fixture.alpha", "fixture.zeta"]);
  });

  it("preserves entries from a structurally compatible existing registry", () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const zeta = defineRuntimeControlExtension<{ count: number }>("fixture.zeta");
    const client = createUnavailableRuntimeControlClient("fixture", new Set());
    const alphaValue = { read: () => "alpha" };
    Object.assign(client, { extensions: Object.freeze({
      has: (descriptor: RuntimeControlExtensionDescriptor<unknown>) => descriptor === alpha,
      get: <T>(descriptor: RuntimeControlExtensionDescriptor<T>) => (
        descriptor === alpha ? alphaValue as T : undefined
      ),
      list: () => Object.freeze(["fixture.alpha"]),
    }) });

    const extended = withRuntimeControlExtensions(client, [[zeta, { count: 7 }]]);

    expect(extended.extensions.get(alpha)?.read()).toBe("alpha");
    expect(extended.extensions.get(zeta)?.count).toBe(7);
    expect(extended.extensions.list()).toEqual(["fixture.alpha", "fixture.zeta"]);
  });

  it("rejects duplicate normalized IDs across repeated enhancers", () => {
    const alpha = defineRuntimeControlExtension<{ read(): string }>("fixture.alpha");
    const duplicate = defineRuntimeControlExtension<{ count: number }>(" fixture.alpha ");
    const client = createUnavailableRuntimeControlClient("fixture", new Set());
    const first = withRuntimeControlExtensions(client, [[alpha, { read: () => "alpha" }]]);

    expect(() => withRuntimeControlExtensions(first, [[duplicate, { count: 7 }]]))
      .toThrow("Duplicate runtime-control extension: fixture.alpha");
  });

  it("delegates a synchronously failing disposal only once", async () => {
    const client = createUnavailableRuntimeControlClient("fixture", new Set());
    const failure = new Error("dispose failed");
    const dispose = vi.fn((): Promise<void> => { throw failure; });
    client.dispose = dispose;
    const extended = withRuntimeControlExtensions(client, []);

    await expect(extended.dispose()).rejects.toBe(failure);
    await expect(extended.dispose()).rejects.toBe(failure);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

import type { RuntimeControlClient } from "./runtime-control-client.js";

declare const extensionType: unique symbol;

export type RuntimeControlExtensionDescriptor<T> = Readonly<{
  id: string;
  [extensionType]?: T;
}>;

export interface RuntimeControlExtensionRegistry {
  has<T>(descriptor: RuntimeControlExtensionDescriptor<T>): boolean;
  get<T>(descriptor: RuntimeControlExtensionDescriptor<T>): T | undefined;
  list(): readonly string[];
}

type RuntimeControlExtensionEntry = readonly [RuntimeControlExtensionDescriptor<unknown>, unknown];

const RESERVED_RUNTIME_CONTROL_EXTENSION_IDS = new Set([
  "authStatus",
  "sessions",
  "models",
  "usage",
  "tasks",
  "workspace",
  "events",
  "extensions",
  "dispose",
]);

function normalizeId(id: string): string {
  const normalized = id.trim();
  if (normalized.length === 0) {
    throw new Error("Runtime-control extension ID must not be blank");
  }
  if (RESERVED_RUNTIME_CONTROL_EXTENSION_IDS.has(normalized)) {
    throw new Error(`Reserved runtime-control extension ID: ${normalized}`);
  }
  return normalized;
}

export function defineRuntimeControlExtension<T>(
  id: string,
): RuntimeControlExtensionDescriptor<T> {
  return Object.freeze({ id: normalizeId(id) });
}

export function createRuntimeControlExtensionRegistry(
  entries: Iterable<RuntimeControlExtensionEntry> = [],
): RuntimeControlExtensionRegistry {
  const snapshot = [...entries];
  const extensions = new Map<RuntimeControlExtensionDescriptor<unknown>, unknown>();
  const registeredIds = new Set<string>();
  for (const [descriptor, extension] of snapshot) {
    const id = normalizeId(descriptor.id);
    if (registeredIds.has(id)) {
      throw new Error(`Duplicate runtime-control extension: ${id}`);
    }
    registeredIds.add(id);
    extensions.set(descriptor, extension);
  }
  const ids = Object.freeze([...registeredIds].sort());

  const registry = Object.freeze({
    has<T>(descriptor: RuntimeControlExtensionDescriptor<T>): boolean {
      return extensions.has(descriptor);
    },
    get<T>(descriptor: RuntimeControlExtensionDescriptor<T>): T | undefined {
      return extensions.get(descriptor) as T | undefined;
    },
    list(): readonly string[] {
      return ids;
    },
  });
  return registry;
}

export function withRuntimeControlExtensions(
  client: RuntimeControlClient,
  entries: Iterable<RuntimeControlExtensionEntry>,
): RuntimeControlClient {
  const additions = createRuntimeControlExtensionRegistry(entries);
  const existing = client.extensions;
  const existingIds = existing.list().map(normalizeId);
  const registeredIds = new Set<string>();
  for (const id of [...existingIds, ...additions.list()]) {
    if (registeredIds.has(id)) {
      throw new Error(`Duplicate runtime-control extension: ${id}`);
    }
    registeredIds.add(id);
  }
  const ids = Object.freeze([...registeredIds].sort());
  const extensions: RuntimeControlExtensionRegistry = Object.freeze({
    has<T>(descriptor: RuntimeControlExtensionDescriptor<T>): boolean {
      return additions.has(descriptor) || existing.has(descriptor);
    },
    get<T>(descriptor: RuntimeControlExtensionDescriptor<T>): T | undefined {
      return additions.has(descriptor)
        ? additions.get(descriptor)
        : existing.get(descriptor);
    },
    list(): readonly string[] {
      return ids;
    },
  });
  let disposal: Promise<void> | undefined;

  return Object.freeze({
    authStatus: client.authStatus,
    sessions: client.sessions,
    models: client.models,
    usage: client.usage,
    tasks: client.tasks,
    workspace: client.workspace,
    events: client.events,
    extensions,
    dispose(): Promise<void> {
      disposal ??= Promise.resolve().then(() => client.dispose());
      return disposal;
    },
  });
}

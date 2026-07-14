import {
  CapabilityUnavailable,
  type RuntimeControlClient,
} from "../core/runtime/control-plane/runtime-control-client.js";

export const RUNTIME_CONTROL_CLIENT_MODULES = [
  "authStatus", "sessions", "models", "usage", "tasks", "workspace", "events",
] as const;

const OPERATIONS = [
  ["authStatus", "listAuthStatus", (plane: RuntimeControlClient) => plane.authStatus.listAuthStatus(), Array.isArray],
  ["sessions", "listSessions", (plane: RuntimeControlClient) => plane.sessions.listSessions(), isPage],
  ["sessions", "getSession", (plane: RuntimeControlClient) => plane.sessions.getSession("session-1"), isEntity],
  ["sessions", "cancelSession", (plane: RuntimeControlClient) => plane.sessions.cancelSession!("session-1"), isEntity],
  ["models", "listModels", (plane: RuntimeControlClient) => plane.models.listModels(), isPage],
  ["usage", "getUsage", (plane: RuntimeControlClient) => plane.usage.getUsage(), isUsage],
  ["tasks", "listTasks", (plane: RuntimeControlClient) => plane.tasks.listTasks(), isPage],
  ["tasks", "getTask", (plane: RuntimeControlClient) => plane.tasks.getTask("task-1"), isEntity],
  ["tasks", "cancelTask", (plane: RuntimeControlClient) => plane.tasks.cancelTask!("task-1"), isEntity],
  ["workspace", "listWorkspaces", (plane: RuntimeControlClient) => plane.workspace.listWorkspaces(), Array.isArray],
  ["workspace", "getWorkspace", (plane: RuntimeControlClient) => plane.workspace.getWorkspace("workspace-1"), isEntity],
  ["events", "subscribe", async (plane: RuntimeControlClient) => {
    const subscription = await plane.events.subscribe({ operationId: "operation-1" }, { onEvent: () => undefined });
    await subscription.dispose();
    return subscription;
  }, isSubscription],
] as const;

export const RUNTIME_CONTROL_CLIENT_OPERATION_CAPABILITIES = {
  "authStatus.listAuthStatus": "controlPlane.authStatus.list",
  "sessions.listSessions": "controlPlane.sessions.list",
  "sessions.getSession": "controlPlane.sessions.get",
  "sessions.cancelSession": "controlPlane.sessions.cancel",
  "models.listModels": "controlPlane.models.list",
  "usage.getUsage": "controlPlane.usage.get",
  "tasks.listTasks": "controlPlane.tasks.list",
  "tasks.getTask": "controlPlane.tasks.get",
  "tasks.cancelTask": "controlPlane.tasks.cancel",
  "workspace.listWorkspaces": "controlPlane.workspace.list",
  "workspace.getWorkspace": "controlPlane.workspace.get",
  "events.subscribe": "controlPlane.events.subscribe",
} as const;

export type RuntimeControlClientOperation = keyof typeof RUNTIME_CONTROL_CLIENT_OPERATION_CAPABILITIES;

export type RuntimeControlClientConformanceHarness = Readonly<{
  /** Provider id every CapabilityUnavailable rejection must identify. */
  providerId: string;
  /** Creates the control plane to exercise. */
  create: () => RuntimeControlClient | Promise<RuntimeControlClient>;
}>;

export type RuntimeControlClientConformanceReport = Readonly<{
  valid: boolean;
  modules: readonly (typeof RUNTIME_CONTROL_CLIENT_MODULES)[number][];
  supported: readonly RuntimeControlClientOperation[];
  unavailable: readonly RuntimeControlClientOperation[];
  failures: readonly string[];
}>;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPage(value: unknown): boolean {
  return object(value) && Array.isArray(value.data)
    && (value.nextCursor === undefined || typeof value.nextCursor === "string");
}

function isEntity(value: unknown): boolean {
  return object(value) && typeof value.id === "string" && object(value.metadata);
}

function isUsage(value: unknown): boolean {
  return object(value) && object(value.tokens) && object(value.cost) && object(value.metadata);
}

function isSubscription(value: unknown): boolean {
  return object(value) && typeof value.dispose === "function";
}

export async function runRuntimeControlClientConformance(
  harness: RuntimeControlClientConformanceHarness,
): Promise<RuntimeControlClientConformanceReport> {
  const plane = await harness.create();
  const modules = RUNTIME_CONTROL_CLIENT_MODULES.filter(
    (moduleName) => object(plane[moduleName]),
  );
  const supported: RuntimeControlClientOperation[] = [];
  const unavailable: RuntimeControlClientOperation[] = [];
  const failures: string[] = [];
  const canDispose = typeof plane.dispose === "function";
  if (!canDispose) failures.push("dispose must be a function");

  try {
    for (const [moduleName, methodName, invoke, validate] of OPERATIONS) {
      const operation = `${moduleName}.${methodName}` as RuntimeControlClientOperation;
      const module = plane[moduleName] as unknown as Record<string, unknown>;
      if (!object(module) || typeof module[methodName] !== "function") {
        failures.push(`${operation} must be a function`);
        continue;
      }
      try {
        const result = await invoke(plane);
        if (validate(result)) supported.push(operation);
        else failures.push(`${operation} returned a non-canonical result`);
      } catch (error) {
        if (!(error instanceof CapabilityUnavailable)) {
          failures.push(`${operation} rejected without CapabilityUnavailable`);
          continue;
        }
        if (error.providerId !== harness.providerId) {
          failures.push(
            `${operation} rejected for provider ${error.providerId}; expected ${harness.providerId}`,
          );
          continue;
        }
        const expectedCapability = RUNTIME_CONTROL_CLIENT_OPERATION_CAPABILITIES[operation];
        if (error.capability !== expectedCapability) {
          failures.push(
            `${operation} rejected with capability ${error.capability}; expected ${expectedCapability}`,
          );
          continue;
        }
        unavailable.push(operation);
      }
    }
  } finally {
    if (canDispose) await plane.dispose();
  }

  return {
    valid: modules.length === RUNTIME_CONTROL_CLIENT_MODULES.length && failures.length === 0,
    modules,
    supported,
    unavailable,
    failures,
  };
}

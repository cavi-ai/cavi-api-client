import {
  CapabilityUnavailable,
  type CanonicalRuntimeControlPlane,
} from "../core/runtime/control-plane/canonical.js";

export const CANONICAL_CONTROL_PLANE_MODULES = [
  "authStatus", "sessions", "models", "usage", "tasks", "workspace", "events",
] as const;

const OPERATIONS = [
  ["authStatus", "listAuthStatus", (plane: CanonicalRuntimeControlPlane) => plane.authStatus.listAuthStatus(), Array.isArray],
  ["sessions", "listSessions", (plane: CanonicalRuntimeControlPlane) => plane.sessions.listSessions(), isPage],
  ["sessions", "getSession", (plane: CanonicalRuntimeControlPlane) => plane.sessions.getSession("session-1"), isEntity],
  ["sessions", "cancelSession", (plane: CanonicalRuntimeControlPlane) => plane.sessions.cancelSession!("session-1"), isEntity],
  ["models", "listModels", (plane: CanonicalRuntimeControlPlane) => plane.models.listModels(), isPage],
  ["usage", "getUsage", (plane: CanonicalRuntimeControlPlane) => plane.usage.getUsage(), isUsage],
  ["tasks", "listTasks", (plane: CanonicalRuntimeControlPlane) => plane.tasks.listTasks(), isPage],
  ["tasks", "getTask", (plane: CanonicalRuntimeControlPlane) => plane.tasks.getTask("task-1"), isEntity],
  ["tasks", "cancelTask", (plane: CanonicalRuntimeControlPlane) => plane.tasks.cancelTask!("task-1"), isEntity],
  ["workspace", "listWorkspaces", (plane: CanonicalRuntimeControlPlane) => plane.workspace.listWorkspaces(), Array.isArray],
  ["workspace", "getWorkspace", (plane: CanonicalRuntimeControlPlane) => plane.workspace.getWorkspace("workspace-1"), isEntity],
  ["events", "subscribe", async (plane: CanonicalRuntimeControlPlane) => {
    const subscription = await plane.events.subscribe({ operationId: "operation-1" }, { onEvent: () => undefined });
    await subscription.dispose();
    return subscription;
  }, isSubscription],
] as const;

export const CANONICAL_CONTROL_PLANE_OPERATION_CAPABILITIES = {
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

export type CanonicalControlPlaneOperation = keyof typeof CANONICAL_CONTROL_PLANE_OPERATION_CAPABILITIES;

export type CanonicalControlPlaneConformanceHarness = Readonly<{
  /** Provider id every CapabilityUnavailable rejection must identify. */
  providerId: string;
  /** Creates the control plane to exercise. */
  create: () => CanonicalRuntimeControlPlane | Promise<CanonicalRuntimeControlPlane>;
}>;

export type CanonicalControlPlaneConformanceReport = Readonly<{
  valid: boolean;
  modules: readonly (typeof CANONICAL_CONTROL_PLANE_MODULES)[number][];
  supported: readonly CanonicalControlPlaneOperation[];
  unavailable: readonly CanonicalControlPlaneOperation[];
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

export async function runCanonicalControlPlaneConformance(
  harness: CanonicalControlPlaneConformanceHarness,
): Promise<CanonicalControlPlaneConformanceReport> {
  const plane = await harness.create();
  const modules = CANONICAL_CONTROL_PLANE_MODULES.filter(
    (moduleName) => object(plane[moduleName]),
  );
  const supported: CanonicalControlPlaneOperation[] = [];
  const unavailable: CanonicalControlPlaneOperation[] = [];
  const failures: string[] = [];
  const canDispose = typeof plane.dispose === "function";
  if (!canDispose) failures.push("dispose must be a function");

  try {
    for (const [moduleName, methodName, invoke, validate] of OPERATIONS) {
      const operation = `${moduleName}.${methodName}` as CanonicalControlPlaneOperation;
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
        const expectedCapability = CANONICAL_CONTROL_PLANE_OPERATION_CAPABILITIES[operation];
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
    valid: modules.length === CANONICAL_CONTROL_PLANE_MODULES.length && failures.length === 0,
    modules,
    supported,
    unavailable,
    failures,
  };
}

import {
  CapabilityUnavailable,
  type RuntimeControlClient,
} from "../core/runtime/control-plane/runtime-control-client.js";
import {
  defineRuntimeControlExtension,
  type RuntimeControlExtensionDescriptor,
} from "../core/runtime/control-plane/extensions.js";
import { isAbortError } from "../core/errors.js";

export type RuntimeControlScenarioStatus = "passed" | "unavailable" | "failed" | "skipped";

export type RuntimeControlScenarioResult = Readonly<{
  id: string;
  status: RuntimeControlScenarioStatus;
  capability: string;
  durationMs: number;
  detail?: string;
}>;

export type RuntimeControlScenarioEnvironment = Readonly<{
  createClient: () => RuntimeControlClient | Promise<RuntimeControlClient>;
  mutationMode: "read-only" | "disposable";
  createResourcePrefix: () => string;
}>;

export type RuntimeControlDisposableResource = Readonly<{
  cleanup: () => void | Promise<void>;
}>;

export type RuntimeControlScenarioExtension = Readonly<{
  createDisposableResources(prefix: string): readonly RuntimeControlDisposableResource[] | Promise<readonly RuntimeControlDisposableResource[]>;
}>;

export const RUNTIME_CONTROL_SCENARIO_EXTENSION: RuntimeControlExtensionDescriptor<RuntimeControlScenarioExtension> =
  defineRuntimeControlExtension("testing.runtime-control-scenarios");

export type RuntimeControlScenarioDefinition = Readonly<{
  id: string;
  capability: string;
  mutation?: boolean;
}>;

export type RuntimeControlScenarioReport = Readonly<{
  scenarios: readonly RuntimeControlScenarioResult[];
  failures: readonly string[];
}>;

export const RUNTIME_CONTROL_SCENARIOS: readonly RuntimeControlScenarioDefinition[] = Object.freeze([
  { id: "auth.status", capability: "controlPlane.authStatus.list" },
  { id: "models.list", capability: "controlPlane.models.list" },
  { id: "sessions.list", capability: "controlPlane.sessions.list" },
  { id: "sessions.get", capability: "controlPlane.sessions.get" },
  { id: "usage.get", capability: "controlPlane.usage.get" },
  { id: "tasks.list", capability: "controlPlane.tasks.list" },
  { id: "tasks.get", capability: "controlPlane.tasks.get" },
  { id: "workspace.list", capability: "controlPlane.workspace.list" },
  { id: "workspace.get", capability: "controlPlane.workspace.get" },
  { id: "events.subscribe", capability: "controlPlane.events.subscribe" },
  { id: "extensions.discovery", capability: "controlPlane.extensions.list" },
  { id: "abort.preflight", capability: "controlPlane.sessions.list.abort" },
  { id: "pagination.sessions", capability: "controlPlane.sessions.cursor" },
  { id: "disposal.cleanup", capability: "controlPlane.testing.disposable", mutation: true },
  { id: "provenance.sessions", capability: "controlPlane.sessions.provenance" },
  { id: "disposal.client", capability: "controlPlane.dispose" },
]);

type ScenarioState = {
  sessions?: Awaited<ReturnType<RuntimeControlClient["sessions"]["listSessions"]>>;
  tasks?: Awaited<ReturnType<RuntimeControlClient["tasks"]["listTasks"]>>;
  workspaces?: Awaited<ReturnType<RuntimeControlClient["workspace"]["listWorkspaces"]>>;
};

function elapsed(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function result(
  definition: RuntimeControlScenarioDefinition,
  status: RuntimeControlScenarioStatus,
  startedAt: number,
  detail?: string,
): RuntimeControlScenarioResult {
  return Object.freeze({
    id: definition.id,
    status,
    capability: definition.capability,
    durationMs: elapsed(startedAt),
    ...(detail === undefined ? {} : { detail }),
  });
}

async function executeRead(
  definition: RuntimeControlScenarioDefinition,
  client: RuntimeControlClient,
  state: ScenarioState,
): Promise<Readonly<{ status: "passed" | "skipped"; detail?: string }>> {
  const passed = Object.freeze({ status: "passed" as const });
  const prerequisiteMissing = Object.freeze({ status: "skipped" as const, detail: "prerequisite-missing" });
  switch (definition.id) {
    case "auth.status": await client.authStatus.listAuthStatus(); return passed;
    case "models.list": await client.models.listModels({ limit: 1 }); return passed;
    case "sessions.list": state.sessions = await client.sessions.listSessions({ limit: 1 }); return passed;
    case "sessions.get": {
      const id = state.sessions?.data[0]?.id;
      if (id === undefined) return prerequisiteMissing;
      await client.sessions.getSession(id);
      return passed;
    }
    case "usage.get": await client.usage.getUsage(); return passed;
    case "tasks.list": state.tasks = await client.tasks.listTasks({ limit: 1 }); return passed;
    case "tasks.get": {
      const id = state.tasks?.data[0]?.id;
      if (id === undefined) return prerequisiteMissing;
      await client.tasks.getTask(id);
      return passed;
    }
    case "workspace.list": state.workspaces = await client.workspace.listWorkspaces(); return passed;
    case "workspace.get": {
      const id = state.workspaces?.[0]?.id;
      if (id === undefined) return prerequisiteMissing;
      await client.workspace.getWorkspace(id);
      return passed;
    }
    case "events.subscribe": {
      const subscription = await client.events.subscribe({ operationId: "runtime-control-scenario-observation" }, { onEvent: () => undefined });
      await subscription.dispose();
      return passed;
    }
    case "extensions.discovery": client.extensions.list(); return passed;
    case "abort.preflight": {
      const controller = new AbortController();
      controller.abort();
      try {
        await client.sessions.listSessions({ limit: 1, signal: controller.signal });
        throw new TypeError("abort signal ignored");
      } catch (error) {
        if (isAbortError(error)) return passed;
        throw error;
      }
      return passed;
    }
    case "pagination.sessions": {
      const cursor = state.sessions?.nextCursor;
      if (cursor === undefined) return prerequisiteMissing;
      await client.sessions.listSessions({ cursor, limit: 1 });
      return passed;
    }
    case "provenance.sessions": {
      const sessions = state.sessions?.data;
      if (sessions === undefined || sessions.length === 0) return prerequisiteMissing;
      for (const session of sessions) {
        if (!session.metadata?.source?.transport || !session.metadata.source.method) throw new TypeError("invalid provenance");
      }
      return passed;
    }
  }
  return passed;
}

function failureDetail(error: unknown): string {
  if (error instanceof TypeError) return "invalid-result";
  return "operation-failed";
}

function validDisposablePrefix(prefix: string): boolean {
  const match = /^cavi-sync-test-(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?-([a-zA-Z0-9][a-zA-Z0-9-]*)$/u.exec(prefix);
  if (match === null) return false;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const timestamp = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  return timestamp.getUTCFullYear() === +year
    && timestamp.getUTCMonth() === +month - 1
    && timestamp.getUTCDate() === +day
    && timestamp.getUTCHours() === +hour
    && timestamp.getUTCMinutes() === +minute
    && timestamp.getUTCSeconds() === +second;
}

export async function runRuntimeControlScenarios(
  environment: RuntimeControlScenarioEnvironment,
): Promise<RuntimeControlScenarioReport> {
  const scenarios: RuntimeControlScenarioResult[] = [];
  const cleanups: Array<() => void | Promise<void>> = [];
  const state: ScenarioState = {};
  let client: RuntimeControlClient | undefined;

  try {
    client = await environment.createClient();
    for (const definition of RUNTIME_CONTROL_SCENARIOS) {
      if (definition.id === "disposal.client") continue;
      const startedAt = Date.now();
      if (definition.mutation) {
        if (environment.mutationMode === "read-only") {
          scenarios.push(result(definition, "skipped", startedAt, "read-only"));
          continue;
        }
        const extension = client.extensions.get(RUNTIME_CONTROL_SCENARIO_EXTENSION);
        if (extension === undefined) {
          scenarios.push(result(definition, "unavailable", startedAt, definition.capability));
          continue;
        }
        try {
          const prefix = environment.createResourcePrefix();
          if (!validDisposablePrefix(prefix)) {
            throw new TypeError("invalid disposable prefix");
          }
          const resources = await extension.createDisposableResources(prefix);
          let invalid = resources.length === 0;
          for (const resource of resources) {
            if (typeof resource?.cleanup === "function") cleanups.push(resource.cleanup);
            else invalid = true;
          }
          if (invalid) throw new TypeError("invalid disposable resources");
          scenarios.push(result(definition, "passed", startedAt));
        } catch (error) {
          scenarios.push(error instanceof CapabilityUnavailable
            ? result(definition, "unavailable", startedAt, error.capability)
            : result(definition, "failed", startedAt, failureDetail(error)));
        }
        continue;
      }
      try {
        const outcome = await executeRead(definition, client, state);
        scenarios.push(result(definition, outcome.status, startedAt, outcome.detail));
      } catch (error) {
        scenarios.push(error instanceof CapabilityUnavailable
          ? result(definition, "unavailable", startedAt, error.capability)
          : result(definition, "failed", startedAt, failureDetail(error)));
      }
    }
  } catch {
    scenarios.push({ id: "client.create", status: "failed", capability: "controlPlane.create", durationMs: 0, detail: "client-create-failed" });
  } finally {
    for (const cleanup of cleanups.reverse()) {
      try { await cleanup(); } catch {
        const index = scenarios.findIndex(({ id }) => id === "disposal.cleanup");
        if (index >= 0) scenarios[index] = { ...scenarios[index], status: "failed", detail: "cleanup-failed" };
      }
    }
    const disposal = RUNTIME_CONTROL_SCENARIOS.at(-1)!;
    const startedAt = Date.now();
    if (client === undefined) {
      scenarios.push(result(disposal, "skipped", startedAt, "client-unavailable"));
    } else {
      try {
        await client.dispose();
        scenarios.push(result(disposal, "passed", startedAt));
      } catch {
        scenarios.push(result(disposal, "failed", startedAt, "dispose-failed"));
      }
    }
  }

  return Object.freeze({
    scenarios: Object.freeze(scenarios),
    failures: Object.freeze(scenarios.filter(({ status }) => status === "failed").map(({ id }) => id)),
  });
}

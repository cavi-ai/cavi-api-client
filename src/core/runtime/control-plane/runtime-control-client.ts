import { createRuntimeControlExtensionRegistry, type RuntimeControlExtensionRegistry } from "./extensions.js";
import type { RuntimeEventClient } from "./events.js";
import type { AuthStatusClient, ModelCatalogClient } from "./models.js";
import type { SessionClient } from "./sessions.js";
import type { TaskClient } from "./tasks.js";
import type { UsageClient } from "./usage.js";
import type { WorkspaceClient } from "./workspace.js";

export interface RuntimeControlClient {
  readonly authStatus: AuthStatusClient;
  readonly sessions: SessionClient;
  readonly models: ModelCatalogClient;
  readonly usage: UsageClient;
  readonly tasks: TaskClient;
  readonly workspace: WorkspaceClient;
  readonly events: RuntimeEventClient;
  readonly extensions: RuntimeControlExtensionRegistry;
  dispose(): Promise<void>;
}

export class CapabilityUnavailable extends Error {
  readonly name = "CapabilityUnavailable";

  constructor(
    readonly providerId: string,
    readonly capability: string,
  ) {
    super(`${capability} is unavailable for provider ${providerId}`);
  }
}

export function createUnavailableRuntimeControlClient(
  providerId: string,
  capabilities: ReadonlySet<string>,
): RuntimeControlClient {
  const unavailable = (capability: string): Promise<never> =>
    Promise.reject(new CapabilityUnavailable(providerId, capability));

  void capabilities;

  return {
    authStatus: {
      listAuthStatus: () => unavailable("controlPlane.authStatus.list"),
    },
    sessions: {
      listSessions: () => unavailable("controlPlane.sessions.list"),
      getSession: () => unavailable("controlPlane.sessions.get"),
      cancelSession: () => unavailable("controlPlane.sessions.cancel"),
    },
    models: {
      listModels: () => unavailable("controlPlane.models.list"),
    },
    usage: {
      getUsage: () => unavailable("controlPlane.usage.get"),
    },
    tasks: {
      listTasks: () => unavailable("controlPlane.tasks.list"),
      getTask: () => unavailable("controlPlane.tasks.get"),
      cancelTask: () => unavailable("controlPlane.tasks.cancel"),
    },
    workspace: {
      listWorkspaces: () => unavailable("controlPlane.workspace.list"),
      getWorkspace: () => unavailable("controlPlane.workspace.get"),
    },
    events: {
      subscribe: () => unavailable("controlPlane.events.subscribe"),
    },
    extensions: createRuntimeControlExtensionRegistry(),
    dispose: () => Promise.resolve(),
  };
}

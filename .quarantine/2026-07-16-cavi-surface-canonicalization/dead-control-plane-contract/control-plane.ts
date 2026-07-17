import type { RuntimeEventClient } from "./events.js";
import type { AuthStatusClient, ModelCatalogClient } from "./models.js";
import type { SessionClient } from "./sessions.js";
import type { TaskClient } from "./tasks.js";
import type { RuntimeTransportCapabilities } from "./transports.js";
import type { UsageClient } from "./usage.js";
import type { WorkspaceClient } from "./workspace.js";

export interface RuntimeControlPlane {
  transports: RuntimeTransportCapabilities;
  sessions?: SessionClient;
  models?: ModelCatalogClient;
  usage?: UsageClient;
  tasks?: TaskClient;
  workspace?: WorkspaceClient;
  authStatus?: AuthStatusClient;
  events?: RuntimeEventClient;
}

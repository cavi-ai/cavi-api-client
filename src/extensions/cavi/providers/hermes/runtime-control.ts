import type { RuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeControlClientOptions } from "../../../../core/runtime/providers/types.js";
import {
  createHermesRuntimeControlClient as createNativeHermesRuntimeControlClient,
  type HermesRuntimeControlOptions,
} from "../../../../providers/hermes/control-plane/factory.js";
import {
  createCaviControlAdapters,
  type CaviControlAdapterOptions,
} from "../../adapters/create-cavi-control-adapters.js";
import { createHermesCaviTaskClient } from "./tasks.js";
import { createHermesCaviWorkspaceClient } from "./workspace.js";

export interface HermesCaviRuntimeControlOptions
  extends Omit<HermesRuntimeControlOptions, "overrides"> {
  /**
   * CAVI Control adapter options. When supplied, the CAVI operator plane backs
   * `workspace` (agent workspace identities from the operator registry, which
   * Hermes has no native equivalent for) and `tasks`.
   */
  cavi?: CaviControlAdapterOptions;
}

/**
 * Hermes runtime-control client with the CAVI Control plane layered on.
 *
 * Everything here is the provider's own factory; this only supplies the
 * modules CAVI serves differently. Without `cavi`, the native factory already
 * returns a full client — `tasks` comes from the kanban plugin Hermes ships.
 */
export async function createHermesRuntimeControlClient(
  options: RuntimeControlClientOptions & HermesCaviRuntimeControlOptions,
): Promise<RuntimeControlClient> {
  const { cavi, ...native } = options;
  if (!cavi) return await createNativeHermesRuntimeControlClient(native);

  const adapters = createCaviControlAdapters(cavi);
  return await createNativeHermesRuntimeControlClient({
    ...native,
    overrides: {
      tasks: createHermesCaviTaskClient(adapters),
      workspace: createHermesCaviWorkspaceClient(adapters),
    },
  });
}

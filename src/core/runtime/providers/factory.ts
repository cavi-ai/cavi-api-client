import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../errors.js";
import { unsupportedRuntimeSurface, type RuntimeClient } from "../client.js";
import type { CreateRuntimeClientOptions } from "./types.js";

export function createRuntimeClient(
  provider: string,
  options: CreateRuntimeClientOptions,
): RuntimeClient {
  const module = options.registry.resolveProvider(provider);
  if (!module) {
    throw new ApiClientError(`Unknown runtime provider "${provider}"`, {
      type: ApiClientErrorType.Configuration,
      code: ApiClientErrorCode.InvalidConfig,
    });
  }
  const create = module.createClient ?? module.createApiClient;
  if (!create) return unsupportedRuntimeSurface(module.kind, "runs");
  return create(options.clientOptions);
}

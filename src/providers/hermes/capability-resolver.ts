import { HERMES_API_ENDPOINTS } from "../../contracts/paths.js";
import { JsonHttpApiClient } from "../../core/http/json-client.js";
import type { ProviderCapabilityResolver } from "../../contracts/capability-source.js";
import { transformHermesCapabilities } from "./capabilities-transform.js";

export type CreateHermesCapabilityResolverOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
  /** Manifest team id for this gateway instance. Defaults to the provider kind. */
  teamId?: string;
};

/**
 * Build the runtime capability resolver for a Hermes API server: GET the
 * capabilities endpoint and transform the envelope into the unified shape.
 * The result is authoritative over the static fallback (design decision M1).
 */
export function createHermesCapabilityResolver(
  options: CreateHermesCapabilityResolverOptions,
): ProviderCapabilityResolver {
  const http = new JsonHttpApiClient("hermes-api-server", {
    baseUrl: options.baseUrl,
    allowRelativeBaseUrl: true,
    includePortalClientIdHeader: false,
    auth: { bearerToken: options.token ?? null },
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  return async (resolverOptions = {}) => {
    const payload = await http.request<unknown>(HERMES_API_ENDPOINTS.capabilities, {
      method: "GET",
      ...(resolverOptions.signal ? { signal: resolverOptions.signal } : {}),
    });
    return transformHermesCapabilities(payload, {
      ...(options.teamId ? { teamId: options.teamId } : {}),
    });
  };
}

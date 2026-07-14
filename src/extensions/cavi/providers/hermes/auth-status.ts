import type { AuthStatusClient, RuntimeAuthStatus } from "../../../../core/runtime/control-plane/models.js";
import type { HermesDashboardRestClient } from "./dashboard-rest.js";

type AuthProvider = {
  id: string;
  name: string;
  flow: string;
  status: {
    logged_in: boolean;
    source?: string | null;
    expires_at?: string | null;
    has_refresh_token?: boolean;
    error?: string | null;
  };
};

function state(status: AuthProvider["status"]): RuntimeAuthStatus["status"] {
  if (!status.logged_in) return "unauthenticated";
  if (status.error) return "unknown";
  if (status.expires_at && Date.parse(status.expires_at) <= Date.now()) return "expired";
  return "authenticated";
}

export function createHermesAuthStatusClient(rest: HermesDashboardRestClient): AuthStatusClient {
  return {
    async listAuthStatus() {
      const payload = await rest.getProviderAuth();
      return (payload.providers as readonly AuthProvider[]).map((provider): RuntimeAuthStatus => ({
        providerId: provider.id,
        status: state(provider.status),
        ...(provider.status.expires_at ? { expiresAt: provider.status.expires_at } : {}),
        ...(provider.status.source ? { sourceCategory: provider.status.source } : {}),
        metadata: {
          provider: "hermes",
          stability: "experimental",
          source: { transport: "http", method: "provider-auth" },
          providerData: {
            displayName: provider.name,
            flow: provider.flow,
            ...(provider.status.has_refresh_token === undefined
              ? {}
              : { hasRefreshToken: provider.status.has_refresh_token }),
          },
        },
      }));
    },
  };
}

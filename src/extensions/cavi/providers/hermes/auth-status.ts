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

function expiry(status: AuthProvider["status"]): { valid: boolean; value?: string; timestamp?: number } {
  if (status.expires_at === undefined || status.expires_at === null) return { valid: true };
  if (status.expires_at.length === 0) return { valid: false };
  const timestamp = Date.parse(status.expires_at);
  return Number.isFinite(timestamp)
    ? { valid: true, value: status.expires_at, timestamp }
    : { valid: false };
}

function state(status: AuthProvider["status"], parsedExpiry: ReturnType<typeof expiry>): RuntimeAuthStatus["status"] {
  if (!status.logged_in) return "unauthenticated";
  if ((status.error !== undefined && status.error !== null && status.error.length > 0) || !parsedExpiry.valid) return "unknown";
  if (parsedExpiry.timestamp !== undefined && parsedExpiry.timestamp <= Date.now()) return "expired";
  return "authenticated";
}

export function createHermesAuthStatusClient(rest: HermesDashboardRestClient): AuthStatusClient {
  return {
    async listAuthStatus() {
      const payload = await rest.getProviderAuth();
      return (payload.providers as readonly AuthProvider[]).map((provider): RuntimeAuthStatus => {
        const parsedExpiry = expiry(provider.status);
        return {
          providerId: provider.id,
          status: state(provider.status, parsedExpiry),
          ...(parsedExpiry.value === undefined ? {} : { expiresAt: parsedExpiry.value }),
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
        };
      });
    },
  };
}

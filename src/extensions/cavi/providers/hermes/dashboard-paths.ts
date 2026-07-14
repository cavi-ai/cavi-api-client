export const HERMES_DASHBOARD_PATHS = {
  sessions: "/api/sessions",
  session: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
  usage: "/api/analytics/usage",
  models: "/api/models",
  providerAuth: "/api/provider-auth",
  profile: "/api/profile",
  config: "/api/config",
} as const;

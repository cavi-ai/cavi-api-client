export const HERMES_DASHBOARD_PATHS = {
  sessions: "/api/sessions",
  session: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
  usage: "/api/analytics/usage",
  models: "/api/models",
  providerAuth: "/api/provider-auth",
  profile: "/api/profile",
  config: "/api/config",
} as const;

export function hermesProfilePath(path: string, profile?: string): string {
  if (profile === undefined) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ profile })}`;
}

export function hermesDashboardSocketUrl(value: string, token?: string): string {
  if (token === undefined) return value;
  const url = new URL(value);
  if (!url.searchParams.has("token") && !url.searchParams.has("ticket") && !url.searchParams.has("internal")) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

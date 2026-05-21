import { resolvePath } from "./resolve.js";
import type { GatewayMode } from "./surfaces.js";

export const PORTAL_DASHBOARD_IDS = ["martina", "scout", "angela", "machine"] as const;

export type PortalDashboardId = (typeof PORTAL_DASHBOARD_IDS)[number];

export function isPortalDashboardId(portalId: string): portalId is PortalDashboardId {
  return (PORTAL_DASHBOARD_IDS as readonly string[]).includes(portalId);
}

export function portalDashboardPath(
  portalId: string,
  mode: GatewayMode = "legacy",
): string | null {
  return isPortalDashboardId(portalId)
    ? resolvePath("portal.dashboard", mode, { portal: portalId })
    : null;
}

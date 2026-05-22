import type { PortalLibraryRef } from "../../contracts/portals.js";
import { getConfiguredTeamRegistry } from "./team-registry-config.js";

export function getFleetLibraryRef(): PortalLibraryRef {
  const ref = getConfiguredTeamRegistry().getFleetLibraryRef();
  if (!ref) {
    throw new Error(
      "Team registry config does not define a fleet library ref. Load TEAM_REGISTRY_CONFIG before using library APIs.",
    );
  }
  return ref;
}

export function resolvePortalLibraryRef(portalId: string): PortalLibraryRef | null {
  return getConfiguredTeamRegistry().resolvePortalLibraryRef(portalId);
}

export function resolveLibraryRefByTeamIdentity(value: string | null | undefined): PortalLibraryRef | null {
  return getConfiguredTeamRegistry().resolveLibraryRefByTeamIdentity(value);
}

export function listPortalLibraryRefs(): PortalLibraryRef[] {
  return getConfiguredTeamRegistry().listLibraryRefs();
}

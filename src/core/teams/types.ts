/** Provider-agnostic team identity — the native tokens, preserved verbatim. */
export type TeamIdentity = {
  name: string;
  displayName: string;
  slug: string;
  code: string;
  aliases: string[];
};

export type TeamMember = {
  id: string;
  identity: TeamIdentity;
  capabilities: string[];
};

/**
 * Provider-agnostic team. A normalized projection of a manifest team that
 * excludes host/domain-specific fields (portal/sector/dispatch/library). Those
 * ride opaquely in `metadata`; core never reads them.
 */
export type Team = {
  id: string;
  identity: TeamIdentity;
  members: TeamMember[];
  capabilities: string[];
  metadata?: Record<string, unknown>;
};

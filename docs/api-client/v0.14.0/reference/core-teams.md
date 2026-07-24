# @cavi-ai/api-client/core/teams

Package subpath: ./core/teams

<a id="symbol-core-teams-createteamdirectory"></a>

## createTeamDirectory

Kind: function

```ts
export declare function createTeamDirectory(teams: readonly Team[]): TeamDirectory;
```

<a id="symbol-core-teams-getteamlookupkeys"></a>

## getTeamLookupKeys

Kind: function

```ts
export declare function getTeamLookupKeys(team: Team): string[];
```

<a id="symbol-core-teams-matchesteamidentifier"></a>

## matchesTeamIdentifier

Kind: function

```ts
export declare function matchesTeamIdentifier(team: Team, identifier: string | null | undefined): boolean;
```

<a id="symbol-core-teams-normalizeteamlookupvalue"></a>

## normalizeTeamLookupValue

Kind: function

```ts
/** Canonical identifier normalization. Verbatim copy of the CAVI registry rule. */
export declare function normalizeTeamLookupValue(value: string): string;
```

<a id="symbol-core-teams-resolveteamfromcollection"></a>

## resolveTeamFromCollection

Kind: function

```ts
export declare function resolveTeamFromCollection(teams: readonly Team[], identifier: string | null | undefined): Team | null;
```

<a id="symbol-core-teams-team"></a>

## Team

Kind: type

```ts
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
```

<a id="symbol-core-teams-teamdirectory"></a>

## TeamDirectory

Kind: interface

```ts
/** Provider-agnostic team directory. Pure resolution over a fixed team set. */
export interface TeamDirectory {
    listTeams(): Team[];
    listMembers(teamId: string): TeamMember[];
    resolveTeam(identifier: string | null | undefined): Team | null;
    requireTeam(identifier: string | null | undefined): Team;
    resolveMember(teamId: string, memberIdentifier: string | null | undefined): TeamMember | null;
    getLookupKeys(team: Team): string[];
}
```

<a id="symbol-core-teams-teamidentity"></a>

## TeamIdentity

Kind: type

```ts
/** Provider-agnostic team identity — the native tokens, preserved verbatim. */
export type TeamIdentity = {
    name: string;
    displayName: string;
    slug: string;
    code: string;
    aliases: string[];
};
```

<a id="symbol-core-teams-teammember"></a>

## TeamMember

Kind: type

```ts
export type TeamMember = {
    id: string;
    identity: TeamIdentity;
    capabilities: string[];
};
```

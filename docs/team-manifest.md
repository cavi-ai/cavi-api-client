# Team Manifest Contract

The team manifest is the preferred consumer-owned shape for frontend team and
agent registry config. The package owns the contract, normalization, path
grammar, and guardrails; the consuming app owns the actual team entries.

## Goals

- Keep the default case small: a team can have one member and still satisfy the
  registry contract.
- Avoid one route per product/team. Shared routes are generated from team and
  member identity.
- Keep product-specific folders as controlled customizations by whitelisting
  relative workspace paths.
- Keep local workspace roots out of HTTP paths. API paths use only team/member
  identity plus the whitelisted relative workspace path.

## Boundary Status

The manifest remains consumer-owned configuration. Shared HTTP, runtime,
gateway envelope, media, wiki, SSE, and WebSocket behavior lives in core and
provider modules; manifest entries should describe teams, members, workspace
whitelists, capabilities, and action overrides only. Do not add transport
behavior, product runtime globals, or local filesystem assumptions to a team
entry.

The generic manifest contract intentionally lives in `src/contracts` because
`team.*` routes are gateway-agnostic. CAVI/operator registry behavior stays in
`src/extensions/cavi/registry`; apps can use the manifest without inheriting a
CAVI registry layout.

## Shape

```ts
import type { TeamManifest } from "@cavi/api-client";

export const TEAM_MANIFEST = {
  version: 1,
  teams: [
    {
      id: "research",
      identity: {
        displayName: "Research",
        slug: "research",
        code: "RND",
        aliases: ["scout-school"],
      },
      workspace: {
        rootPath: "/teams/research/workspace-research",
        paths: [
          "research/complete",
          { key: "media.images", path: "media/images" },
        ],
      },
      actions: [
        {
          id: "summarize",
          input: {
            mode: "json",
            params: [{ key: "documentId", type: "string", required: true }],
          },
          output: { mode: "json", contentType: "application/json" },
        },
      ],
      members: [
        {
          id: "scout",
          capabilities: ["research.complete"],
        },
      ],
    },
  ],
  bindings: [
    {
      id: "research-chat",
      teamId: "research",
      memberId: "scout",
      source: "chat",
      sessionKeyPattern: "agent:{memberId}:*",
      routeKey: "agent.config",
    },
  ],
} satisfies TeamManifest;
```

## Generated Routes

Common routes are generated from identity:

```ts
resolvePath("team.kanban", "canonical", { teamId: "research" });
// /api/teams/research/kanban

resolvePath("team.runs", "canonical", { teamId: "research" });
// /api/teams/research/runs

resolvePath("team.config", "canonical", { teamId: "research" });
// /api/teams/research/config

resolvePath("team.agent.config", "canonical", {
  teamId: "research",
  agentId: "scout",
});
// /api/teams/research/agents/scout/config
```

Workspace API routes are also generated, but callers should use the manifest
resolver so the path is checked against the whitelist:

```ts
const manifest = normalizeTeamManifest(TEAM_MANIFEST);
const team = findTeamManifestTeam(manifest, "research");

if (!team) throw new Error("missing team");

resolveTeamWorkspaceApiPath(team, "media.images", { memberId: "scout" });
// /api/teams/research/agents/scout/workspace/media/images

resolveTeamWorkspacePath(team, "media.images", { memberId: "scout" });
// /teams/research/workspace-research/media/images
```

`resolveTeamWorkspacePath` returns a local workspace path for trusted consumer
code. `resolveTeamWorkspaceApiPath` returns the HTTP path and never includes the
workspace root.

Team/member/action IDs are single URL path segments, so slashes, backslashes,
query/hash characters, and dot segments are rejected instead of encoded.
Workspace roots must be absolute path roots, and workspace entries must be
relative allowlist entries with no traversal or encoded separators.

## Gateway Route Bindings

Bindings connect runtime sources to manifest-owned teams, members, and actions
without adding package-level routes for every chat app, room, or deployment.
The consumer owns binding entries; this package normalizes them and resolves the
final route through the same team route grammar.

```ts
const binding = resolveGatewayRouteBinding(manifest, {
  source: "chat",
  key: "agent:scout:main",
  agentId: "scout",
});

binding?.path;
// /api/teams/research/agents/scout/config
```

`sessionKeyPattern` supports `*` wildcards plus `{teamId}`, `{memberId}`, and
`{actionId}` placeholders. If no explicit `routeKey` is supplied, action
bindings resolve to team or member action routes, and non-action bindings
resolve to the team runs route.

## Action Overrides

Actions are the generic escape hatch for agent-specific behavior. Define the
shared action contract once at the manifest or team level, then let a team or
member override the last details.

```ts
const manifest = normalizeTeamManifest({
  version: 1,
  actions: [
    {
      id: "joke",
      input: {
        mode: "command",
        command: "/joke",
        params: [
          { key: "topic", type: "string", required: true },
          { key: "dark", type: "boolean", default: false },
        ],
      },
      output: { mode: "markdown", contentType: "text/markdown" },
      defaults: { long: false },
    },
  ],
  teams: [
    {
      id: "machine",
      actions: [{ id: "joke", defaults: { long: true } }],
      members: [
        {
          id: "chris",
          actions: [
            {
              id: "joke",
              output: { mode: "json", contentType: "application/json" },
              defaults: { dark: true, style: "degen" },
            },
          ],
        },
      ],
    },
  ],
});

const action = resolveTeamActionContract(manifest, "machine", "joke", {
  memberId: "chris",
});

resolveTeamActionApiPath(manifest, "machine", "joke", { memberId: "chris" });
// /api/teams/machine/agents/chris/actions/joke
```

The merge order is:

1. Manifest action defaults.
2. Team action overrides.
3. Member action overrides.
4. Request-time params owned by the consumer or gateway.

Command strings such as `/joke --dark --long "topic"` should be treated as UI
sugar. Consumers should normalize them to the resolved action id plus params
before sending the request. Responses should use the stable `TeamActionResponse`
union (`json`, `text`, `markdown`, or `artifact`) instead of inventing a custom
body shape for each agent.

## Add Or Remove Agents

Keep add/remove logic in the consumer. A registry editor should mutate the
consumer manifest, then pass the normalized manifest into this package:

```ts
configureTeamRegistryConfig({
  provider: "gateway",
  manifest: normalizeTeamManifest(TEAM_MANIFEST),
});
```

Use [team-manifest.consumer.template.ts](team-manifest.consumer.template.ts)
as the reference shape for consumer-side add/remove helpers.
Use [cavi-team-manifest.example.ts](cavi-team-manifest.example.ts) as the
CAVI plugin-owned starter manifest for control-plane, research, project-ops,
and machine portals.

## Compatibility

Legacy CAVI, Deb, Martina, Machine, Front Door, and portal-memory paths remain
compatibility contracts. New team-shaped frontend surfaces should prefer the
agnostic `team.*` contracts and manifest workspace whitelist rather than adding
another product-specific path literal.

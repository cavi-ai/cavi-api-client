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

## Compatibility

Legacy CAVI, Deb, Martina, Machine, Front Door, and portal-memory paths remain
compatibility contracts. New team-shaped frontend surfaces should prefer the
agnostic `team.*` contracts and manifest workspace whitelist rather than adding
another product-specific path literal.

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
`team.*` routes are provider-agnostic. CAVI/operator registry behavior stays in
`src/extensions/cavi/registry`; apps can use the manifest without inheriting a
CAVI registry layout.

## Shape

```ts
import type { TeamManifest } from "@cavi-ai/api-client";

export const TEAM_MANIFEST = {
  version: 1,
  teams: [
    {
      id: "research",
      identity: {
        displayName: "Research",
        slug: "research",
        code: "RND",
        aliases: ["research-docs"],
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
          id: "analyst",
          capabilities: ["research.complete"],
        },
      ],
    },
  ],
  bindings: [
    {
      id: "research-chat",
      teamId: "research",
      memberId: "analyst",
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
resolvePath("team.kanban", { teamId: "research" });
// /api/teams/research/kanban

resolvePath("team.runs", { teamId: "research" });
// /api/teams/research/runs

resolvePath("team.config", { teamId: "research" });
// /api/teams/research/config

resolvePath("team.agent.config", {
  teamId: "research",
  agentId: "analyst",
});
// /api/teams/research/agents/analyst/config
```

`team.kanban` is a team-shaped compatibility route. Native OpenClaw Workboard
uses board IDs through `workboard.*` Gateway RPC; CAVI compatibility adapters may
map a `teamId` to a Workboard `boardId`, but this package does not make that
mapping the upstream contract.

Workspace API routes are also generated, but callers should use the manifest
resolver so the path is checked against the whitelist:

```ts
const manifest = normalizeTeamManifest(TEAM_MANIFEST);
const team = findTeamManifestTeam(manifest, "research");

if (!team) throw new Error("missing team");

resolveTeamWorkspaceApiPath(team, "media.images", { memberId: "analyst" });
// /api/teams/research/agents/analyst/workspace/media/images

resolveTeamWorkspacePath(team, "media.images", { memberId: "analyst" });
// /teams/research/workspace-research/media/images
```

`resolveTeamWorkspacePath` returns a local workspace path for trusted consumer
code. `resolveTeamWorkspaceApiPath` returns the HTTP path and never includes the
workspace root.

Team/member/action IDs are single URL path segments, so slashes, backslashes,
query/hash characters, and dot segments are rejected instead of encoded.
Workspace roots must be absolute path roots, and workspace entries must be
relative allowlist entries with no traversal or encoded separators.

## Workspace Files And Path Safety

The workspace whitelist is the security boundary for file access, and it is the
**recommended** way to resolve any workspace file. A consumer declares the
relative paths it allows in `workspace.paths`; `resolveTeamWorkspacePath` /
`resolveTeamWorkspaceApiPath` resolve **only** those entries. A path that was
never declared cannot be resolved — `..`, absolute paths, backslashes, and
percent-encoded separators (`%2e%2e`) are rejected, not encoded.

```ts
resolveTeamWorkspaceApiPath(team, "media.images", { memberId: "analyst" });
// ok — "media.images" is whitelisted

resolveTeamWorkspaceApiPath(team, "../../etc/passwd");
// throws — not whitelisted, and traversal is rejected outright
```

Some endpoints take a **raw** relative path as a `?path=` query instead of going
through the whitelist — e.g. `GATEWAY_WIKI_API_ENDPOINTS.read(vaultId, path)` and
manifest action routes that carry a `query`. `appendHttpQuery` (which builds
those query strings) **does not sanitize values** — it only URL-encodes them, so
`?path=../secret` is sent as `?path=..%2Fsecret` and the backend decodes it back.

> **This package owns a single trusted frontend, but downstream consumers may
> not.** If you accept a free-form path from anywhere less trusted than your own
> code, validate it with `assertSafeRelativePath` before sending it:

```ts
import { appendHttpQuery, assertSafeRelativePath } from "@cavi-ai/api-client";

const safe = assertSafeRelativePath(userSuppliedPath); // throws on traversal
const url = appendHttpQuery("/v1/wiki/vaults/notes/read", { path: safe });
```

`assertSafeRelativePath` enforces the same relative-path rules as the workspace
whitelist (no absolute paths, schemes, backslashes, or `.`/`..` segments incl.
encoded forms) and returns the cleaned `a/b/c` form. Prefer the whitelist when
you can; reach for the helper only when a path is genuinely free-form.

## Gateway Route Bindings

Bindings connect runtime sources to manifest-owned teams, members, and actions
without adding package-level routes for every chat app, room, or deployment.
The consumer owns binding entries; this package normalizes them and resolves the
final route through the same team route grammar.

```ts
const binding = resolveGatewayRouteBinding(manifest, {
  source: "chat",
  key: "agent:analyst:main",
  agentId: "analyst",
});

binding?.path;
// /api/teams/research/agents/analyst/config
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
      id: "render",
      input: {
        mode: "command",
        command: "/render",
        params: [
          { key: "prompt", type: "string", required: true },
          { key: "draft", type: "boolean", default: false },
        ],
      },
      output: { mode: "markdown", contentType: "text/markdown" },
      defaults: { format: "summary" },
    },
  ],
  teams: [
    {
      id: "creative",
      actions: [{ id: "render", defaults: { format: "brief" } }],
      members: [
        {
          id: "designer",
          actions: [
            {
              id: "render",
              output: { mode: "json", contentType: "application/json" },
              defaults: { draft: true, style: "concise" },
            },
          ],
        },
      ],
    },
  ],
});

const action = resolveTeamActionContract(manifest, "creative", "render", {
  memberId: "designer",
});

resolveTeamActionApiPath(manifest, "creative", "render", { memberId: "designer" });
// /api/teams/creative/agents/designer/actions/render
```

The merge order is:

1. Manifest action defaults.
2. Team action overrides.
3. Member action overrides.
4. Request-time params owned by the consumer or gateway.

Command strings such as `/render --draft "prompt"` should be treated as UI
sugar. Consumers should normalize them to the resolved action id plus params
before sending the request. Responses should use the stable `TeamActionResponse`
union (`json`, `text`, `markdown`, or `artifact`) instead of inventing a custom
body shape for each agent.

## Member-Action Surfaces

Per-agent and per-plugin HTTP surfaces are declared as **member actions**, not as
package-level route tables. An action's `route` pins it to an explicit endpoint:

```ts
{
  id: "machine",
  actions: [
    { id: "dashboard", route: { method: "GET",  surfaceKey: "machine.dashboard", path: "/api/plugins/machine/dashboard" } },
    { id: "comedyRun", route: { method: "POST", surfaceKey: "machine.comedyRun", path: "/v1/runs" } },
  ],
}
// resolveTeamActionApiPath(manifest, teamId, "dashboard", { memberId: "machine" })
//   -> "/api/plugins/machine/dashboard"
```

When `route.path` is set, `resolveTeamActionApiPath` returns it directly; otherwise
it falls back to the generated `agent.action` / `action` route. This is why the
package ships **no** concrete agent slugs — the host manifest owns its fleet's
surfaces, and `route.surfaceKey` gives each a stable name for lookup.

## Manifest Source And Route Resolver

The package exposes a seam so hosts can supply (and cache) the manifest however
they like, and override route resolution without forking:

- `TeamManifestSource` (`createStaticManifestSource`, `createCachedManifestSource`)
  — where the manifest comes from (a static object, or a cached async fetch).
- `TeamRouteResolver` (`createTeamRouteResolver`) — resolves `team.*`, action, and
  workspace routes; a host can wrap it to customize resolution.

## Add Or Remove Agents

Keep add/remove logic in the consumer. A registry editor should mutate the
consumer manifest, then pass the normalized manifest into this package.
`normalizeTeamManifest` is provider-agnostic and lives at the root entry;
`configureTeamRegistryConfig` and the `TeamRegistryConfig` type are CAVI-registry
concepts and ship on the `@cavi-ai/api-client/extensions/cavi` subpath:

```ts
import { normalizeTeamManifest } from "@cavi-ai/api-client";
import { configureTeamRegistryConfig } from "@cavi-ai/api-client/extensions/cavi";

configureTeamRegistryConfig({
  provider: "gateway",
  manifest: normalizeTeamManifest(TEAM_MANIFEST),
});
```

Use [team-manifest.consumer.template.ts](team-manifest.consumer.template.ts)
as the reference shape for consumer-side add/remove helpers.
Use [cavi-team-manifest.example.ts](cavi-team-manifest.example.ts) as a
neutral CAVI extension manifest example.

## Extension Path Ownership

The generic manifest contract stays in `src/contracts/**` because `team.*`
routes are provider-agnostic. CAVI plugin routes stay in
`src/extensions/cavi/contracts/**`; they should append to extension-owned base
paths with helpers such as `appendCaviApiPath`, `resolvePortalApiPath`, or
`resolveLibraryApiPath` instead of adding product-specific route grammar to
core contracts.

## Path Policy

Extension-specific paths stay inside their extension folder. New team-shaped
frontend surfaces should prefer the agnostic `team.*` contracts and manifest
workspace whitelist rather than adding another product-specific path literal.

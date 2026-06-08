// Consumer/plugin-owned CAVI team manifest example.
// Keep this in the gateway/plugin config layer, then send it to mobile/web as
// runtime configuration. Do not move these entries into package defaults.
// Host/domain identity hints (CAVI portalId/sector) live in `identity.metadata`,
// never as top-level identity fields — provider-agnostic core never reads them.
// `TeamRegistryConfig` is a CAVI-registry type and ships on the
// `/extensions/cavi` subpath, not the root entry.
import { normalizeTeamManifest, type TeamManifest } from "@cavi-ai/api-client";
import type { TeamRegistryConfig } from "@cavi-ai/api-client/extensions/cavi";

export const CAVI_TEAM_MANIFEST = {
  version: 1,
  actions: [
    {
      id: "status-report",
      input: {
        mode: "json",
        params: [{ key: "window", type: "string", default: "today" }],
      },
      output: { mode: "markdown", contentType: "text/markdown" },
      capabilities: ["status.read"],
    },
  ],
  teams: [
    {
      id: "control-plane",
      identity: {
        displayName: "Control Plane",
        slug: "control-plane",
        code: "CTRL",
        aliases: ["ops-control"],
        metadata: { portalId: "operator" },
      },
      workspace: {
        rootPath: "/teams/control-plane/workspace-control-plane",
        paths: [
          "ops/status",
          { key: "dispatch.templates", path: "dispatch/spawn-templates" },
        ],
      },
      actions: [
        {
          id: "operator-snapshot",
          input: { mode: "json" },
          output: { mode: "json", contentType: "application/json" },
          capabilities: ["operator.snapshot"],
        },
      ],
      members: [
        {
          id: "operator-team",
          capabilities: ["operator.read", "operator.write"],
        },
      ],
    },
    {
      id: "research",
      identity: {
        displayName: "Research",
        slug: "research",
        code: "RND",
        aliases: ["research-docs"],
        metadata: { portalId: "research" },
      },
      workspace: {
        rootPath: "/teams/research/workspace-research",
        paths: [
          "research/complete",
          { key: "media.images", path: "media/images" },
          { key: "state.public", path: "state/public" },
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
          capabilities: ["research.complete"],
        },
      ],
      members: [
        {
          id: "research-operator",
          capabilities: ["research.complete", "media.images"],
          actions: [{ id: "summarize", defaults: { lane: "research-operator" } }],
        },
      ],
    },
    {
      id: "project-ops",
      identity: {
        displayName: "Project Ops",
        slug: "project-ops",
        code: "PROJ",
        aliases: ["project-board"],
        metadata: { portalId: "project-ops" },
      },
      workspace: {
        rootPath: "/teams/project-ops/workspace-project-ops",
        paths: [
          { key: "board.backlog", path: "project-board/backlog" },
          { key: "board.sprint", path: "project-board/sprint" },
        ],
      },
      actions: [
        {
          id: "sync-backlog",
          input: {
            mode: "json",
            params: [{ key: "sprintId", type: "string" }],
          },
          output: { mode: "json", contentType: "application/json" },
          capabilities: ["project-board.write"],
        },
      ],
      members: [
        {
          id: "project-board",
          capabilities: ["project-board.read", "project-board.write"],
        },
      ],
    },
    {
      id: "creative",
      identity: {
        displayName: "Creative",
        slug: "creative",
        code: "CRTV",
        aliases: ["creative-studio"],
        metadata: { portalId: "creative" },
      },
      workspace: {
        rootPath: "/teams/creative/workspace-creative",
        paths: [
          { key: "media.images", path: "media/images" },
          { key: "media.audio", path: "media/audio" },
        ],
      },
      actions: [
        {
          id: "render-image",
          input: { mode: "json" },
          output: {
            mode: "artifact",
            artifacts: [{ key: "image", contentType: "image/png" }],
          },
          capabilities: ["media.image.generate"],
        },
        {
          id: "speak",
          input: { mode: "text" },
          output: { mode: "artifact", contentType: "audio/mpeg" },
          capabilities: ["media.audio.generate"],
        },
      ],
      members: [
        {
          id: "creative-studio",
          capabilities: ["media.image.generate", "media.audio.generate"],
        },
      ],
    },
  ],
  bindings: [
    {
      id: "research-chat",
      teamId: "research",
      memberId: "research-operator",
      source: "chat",
      sessionKeyPattern: "agent:{memberId}:*",
      routeKey: "agent.config",
    },
    {
      id: "project-ops-sync",
      teamId: "project-ops",
      memberId: "project-board",
      source: "portal",
      channel: "project-ops",
      actionId: "sync-backlog",
    },
    {
      id: "operator-runs",
      teamId: "control-plane",
      source: "operator",
      routeKey: "runs",
    },
  ],
} satisfies TeamManifest;

export function createCaviTeamRegistryConfig(): TeamRegistryConfig {
  return {
    provider: "openclaw",
    manifest: normalizeTeamManifest(CAVI_TEAM_MANIFEST),
    libraries: {
      fleet: {
        scope: "fleet",
        libraryTeamId: "cavi-fleet-library",
        ownerPortalId: "operator",
        lookupKeys: ["fleet-library", "control-plane-library"],
      },
      teams: [
        {
          scope: "team",
          libraryTeamId: "research-library",
          ownerPortalId: "research",
          lookupKeys: ["research-docs"],
        },
        {
          scope: "team",
          libraryTeamId: "project-ops-library",
          ownerPortalId: "project-ops",
          lookupKeys: ["project-board-docs"],
        },
      ],
    },
  };
}

// Consumer/plugin-owned CAVI team manifest example.
// Keep this in the gateway/plugin config layer, then send it to mobile/web as
// runtime configuration. Do not move these entries into package defaults.
import {
  normalizeTeamManifest,
  type TeamManifest,
  type TeamRegistryConfig,
} from "@cavi-ai/api-client";

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
        portalId: "operator",
        aliases: ["ops-control"],
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
        portalId: "scout",
        aliases: ["scout-school"],
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
        portalId: "deb",
        aliases: ["project-board"],
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
      id: "machine",
      identity: {
        displayName: "Machine",
        slug: "machine",
        code: "MCH",
        portalId: "machine",
        aliases: ["comedy-room"],
      },
      workspace: {
        rootPath: "/teams/machine/workspace-machine",
        paths: [
          { key: "media.images", path: "media/images" },
          { key: "media.audio", path: "media/audio" },
        ],
      },
      actions: [
        {
          id: "render-meme",
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
          id: "comedy-room",
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
      id: "project-board-sync",
      teamId: "project-ops",
      memberId: "project-board",
      source: "portal",
      channel: "deb",
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
          ownerPortalId: "scout",
          lookupKeys: ["research-docs", "scout-school"],
        },
        {
          scope: "team",
          libraryTeamId: "project-ops-library",
          ownerPortalId: "deb",
          lookupKeys: ["project-board-docs"],
        },
      ],
    },
  };
}

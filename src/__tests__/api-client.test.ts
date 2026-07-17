import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseHttpApiClient } from "../core/http/client";
import { resolveHttpApiConfigFromEnv } from "../extensions/cavi/runtime/env-config";
import { resolveHermesHttpApiConfigFromEnv } from "../providers/hermes/env-config";
import {
  appendHttpQuery,
  GATEWAY_MEDIA_API_ENDPOINTS,
  GATEWAY_WIKI_API_ENDPOINTS,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
} from "../contracts/paths";
import { OPENCLAW_RPC_METHODS } from "../providers/openclaw/manifest.derive";
import {
  CAVI_CONTROL_OPERATOR_API,
  CAVI_CONTROL_API_ENDPOINTS,
  LIBRARY_API_ENDPOINTS,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS,
  OPERATOR_DISPATCH_ENDPOINTS,
  resolveLibraryApiPath,
} from "../extensions/cavi/contracts/paths";
import {
  GatewayApiClient,
  RUN_STREAM_EVENT_NAMES,
  createDefaultTeamManifest,
  createGatewayMediaClient,
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
  createGatewayWikiClient,
  normalizeTeamManifest,
  SURFACE_CONTRACTS,
  resolvePath,
  resolveGatewayRouteBinding,
  resolveTeamActionApiPath,
  resolveTeamActionContract,
  resolveTeamRoutePath,
  resolveTeamWorkspaceApiPath,
  resolveTeamWorkspacePath,
  DEFAULT_TEAM_ROUTE_KEYS,
  getErrorCode,
  ApiClientErrorCode,
} from "../index";
import {
  GatewayMediaApiClient,
  GatewaySseRunEventProvider,
  GatewayWikiApiClient,
  GATEWAY_MEDIA_KINDS,
  GATEWAY_WIKI_FORMATS,
} from "../core/gateway/index";
import {
  HermesMediaApiClient,
  HERMES_PROVIDER_MODULE,
  HermesSseRunEventProvider,
  HermesWebSocketClient,
  HermesWikiApiClient,
} from "../providers/hermes/index";
import {
  OpenClawApiClient,
  OpenClawMediaApiClient,
  OPENCLAW_PROVIDER_MODULE,
  OpenClawSseRunEventProvider,
  OpenClawWebSocketClient,
  OpenClawWikiApiClient,
} from "../providers/openclaw/index";
import {
  MOBILE_GATEWAY_ENDPOINT_CONTRACTS,
  PortalApiClient,
  PORTAL_MEMORY_SNAPSHOT_CONTRACT,
  buildPortalMemoryEnvelope,
  createContractGap,
  createTeamRegistry,
  getMobileGatewayEndpointPath,
  portalDashboardPath,
  resolveOperatorTaskDispatchPath,
  CAVI_SURFACE_CONTRACTS,
  resolveCaviPath,
  withCaviControlOperatorCapabilities,
} from "../extensions/cavi/index";
import { LibraryApiClient } from "../extensions/cavi/library/client";
import type { HttpApiClientOptions, HttpApiRequestInit } from "../core/http/types";

const BUILT_IN_PROVIDER_MODULES = [
  HERMES_PROVIDER_MODULE,
  OPENCLAW_PROVIDER_MODULE,
] as const;

class TestApiClient extends BaseHttpApiClient {
  constructor(options: HttpApiClientOptions) {
    super("test-api", options);
  }

  get<T = unknown>(path: string, init?: HttpApiRequestInit): Promise<T> {
    return this.requestJson<T>(path, init);
  }
}

class HeaderOverrideClient extends TestApiClient {
  protected override buildHeaders(init?: HttpApiRequestInit): Record<string, string> {
    return { ...super.buildHeaders(init), "X-Override": "yes" };
  }
}

describe("agnostic HTTP API client package", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves canonical env values before aliases and falls back library config to CAVI", () => {
    const config = resolveHttpApiConfigFromEnv({
      CAVI_API_BASE_URL: " https://canonical.example ",
      EXPO_PUBLIC_CAVI_API_BASE_URL: "https://alias.example",
      CAVI_API_AUTH_TOKEN: " token-value ",
      CAVI_API_CLIENT_ID: " cavi-client ",
      GATEWAY_API_BASE_URL: "https://gateway.example",
    });

    expect(config.cavi).toEqual({
      baseUrl: "https://canonical.example",
      authToken: "token-value",
      clientId: "cavi-client",
    });
    expect(config.gateway).toEqual({
      baseUrl: "https://gateway.example",
      authToken: null,
      clientId: "cavi-api-client",
    });
    expect(config.library).toEqual({
      baseUrl: "https://canonical.example",
      authToken: "token-value",
      clientId: "cavi-client",
    });
  });

  it("keeps Hermes env compatibility behind the Hermes provider resolver", () => {
    const config = resolveHermesHttpApiConfigFromEnv({
      HERMES_API_BASE_URL: " https://hermes.example ",
      EXPO_PUBLIC_HERMES_API_BASE_URL: "https://alias.example",
      HERMES_API_AUTH_TOKEN: " hermes-token ",
      HERMES_API_CLIENT_ID: " hermes-client ",
    });

    expect(config).toEqual({
      baseUrl: "https://hermes.example",
      authToken: "hermes-token",
      clientId: "hermes-client",
    });
  });

  it("keeps extracted endpoint builders encoded and aligned", () => {
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.root).toBe(
      "/cavi-control/api/operator",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.task("task/a b")).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.taskDiscourse("task/a b")).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b/discourse",
    );
    expect(HERMES_API_ENDPOINTS.runApproval("run/1")).toBe("/v1/runs/run%2F1/approval");
    expect(HERMES_API_ENDPOINT_TEMPLATES.runApproval).toBe("/v1/runs/{run_id}/approval");
    expect(HERMES_API_ENDPOINT_TEMPLATES.ecgSharedFiles).toBe("/api/v1/files?agent={agent}&folder={folder}");
    expect(GATEWAY_MEDIA_KINDS).toEqual(["audio", "image", "video", "music"]);
    expect(GATEWAY_MEDIA_API_ENDPOINTS.providers()).toBe("/v1/media/providers");
    expect(GATEWAY_MEDIA_API_ENDPOINTS.providers("audio")).toBe(
      "/v1/media/audio/providers",
    );
    expect(GATEWAY_MEDIA_API_ENDPOINTS.generate("music")).toBe(
      "/v1/media/music/generate",
    );
    expect(GATEWAY_MEDIA_API_ENDPOINTS.generate("image")).toBe(
      "/v1/media/image/generate",
    );
    expect(GATEWAY_MEDIA_API_ENDPOINTS.job("video", "job/a b")).toBe(
      "/v1/media/video/jobs/job%2Fa%20b",
    );
    expect(GATEWAY_MEDIA_API_ENDPOINTS.assets()).toBe("/v1/media/assets");
    expect(GATEWAY_MEDIA_API_ENDPOINTS.assets({ kind: "image" })).toBe(
      "/v1/media/assets?kind=image",
    );
    expect(GATEWAY_MEDIA_API_ENDPOINTS.assets({
      kind: "image",
      cursor: "next page",
      limit: 25,
    })).toBe("/v1/media/assets?kind=image&cursor=next+page&limit=25");
    expect(GATEWAY_MEDIA_API_ENDPOINTS.asset("asset/a b")).toBe(
      "/v1/media/assets/asset%2Fa%20b",
    );
    expect(GATEWAY_WIKI_FORMATS).toEqual(["qmd", "markdown", "html", "pdf", "text", "json"]);
    expect(GATEWAY_WIKI_API_ENDPOINTS.vaults).toBe("/v1/wiki/vaults");
    expect(GATEWAY_WIKI_API_ENDPOINTS.tree("research vault")).toBe(
      "/v1/wiki/vaults/research%20vault/tree",
    );
    expect(GATEWAY_WIKI_API_ENDPOINTS.read("research", "notes/index.qmd")).toBe(
      "/v1/wiki/vaults/research/read?path=notes%2Findex.qmd",
    );
    expect(GATEWAY_WIKI_API_ENDPOINTS.ingest("research")).toBe(
      "/v1/wiki/vaults/research/ingest",
    );
    expect(GATEWAY_WIKI_API_ENDPOINTS.compile("research")).toBe(
      "/v1/wiki/vaults/research/compile",
    );
    expect(GATEWAY_WIKI_API_ENDPOINTS.promote("research")).toBe(
      "/v1/wiki/vaults/research/promote",
    );
    expect(OPERATOR_DISPATCH_ENDPOINTS.operatorEvents).toBe("/operator/events");
    expect(OPERATOR_DISPATCH_ENDPOINTS.taskReceiptsTemplate).toBe(
      "/cavi-control/api/tasks/{taskId}/receipts",
    );
    expect(LIBRARY_API_ENDPOINTS.document("doc/1")).toBe("/api/plugins/library/documents/doc%2F1");
    expect(LIBRARY_API_ENDPOINTS.fleetStatus).toBe("/api/plugins/library/fleet-status");
    expect(LIBRARY_API_ENDPOINTS.status).toBe("/api/plugins/library/status");
    expect(LIBRARY_API_ENDPOINTS.inbox).toBe("/api/plugins/library/inbox");
    expect(LIBRARY_API_ENDPOINTS.promotable).toBe("/api/plugins/library/promotable");
    expect(LIBRARY_API_ENDPOINTS.reviewRequests).toBe("/api/plugins/library/review-requests");
    expect(resolveLibraryApiPath("search")).toBe("/api/plugins/library/search");
    expect(resolveLibraryApiPath("/api/plugins/library/search")).toBe("/api/plugins/library/search");
    expect(appendHttpQuery("/api/plugins/library/search", { q: "top 10", page: 2, skip: undefined })).toBe(
      "/api/plugins/library/search?q=top+10&page=2",
    );
  });

  it("resolves surface paths", () => {
    expect(CAVI_CONTROL_API_ENDPOINTS.operator).toBe(CAVI_CONTROL_OPERATOR_API);
    expect(CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.snapshot).toBe(
      "/api/plugins/cavi-control/operator/snapshot",
    );
    expect(CAVI_SURFACE_CONTRACTS["portal.dashboard"]?.method).toBe("GET");
    expect(resolveCaviPath("portal.dashboard", { portal: "martina" })).toBe(
      "/api/plugins/portal/martina/dashboard",
    );
    expect(resolveCaviPath("cavi.operator.registry")).toBe(
      "/cavi-control/api/operator/registry",
    );
    expect(resolveCaviPath("cavi.operator.snapshot")).toBe(
      "/cavi-control/api/operator/snapshot",
    );
    expect(resolveCaviPath("cavi.operator.tasks")).toBe(
      "/cavi-control/api/operator/tasks",
    );
    expect(resolvePath("kanban.board")).toBe("/api/plugins/kanban/board");
    expect(resolvePath("team.kanban", { teamId: "research team" })).toBe(
      "/api/teams/research%20team/kanban",
    );
    expect(resolvePath("team.agent.config", {
      teamId: "research",
      agentId: "scout a",
    })).toBe("/api/teams/research/agents/scout%20a/config");
    expect(resolvePath("team.action", {
      teamId: "machine",
      actionId: "joke dark",
    })).toBe("/api/teams/machine/actions/joke%20dark");
    expect(resolvePath("team.agent.action", {
      teamId: "machine",
      agentId: "chris a",
      actionId: "joke",
    })).toBe("/api/teams/machine/agents/chris%20a/actions/joke");
    expect(resolvePath("team.workspace", {
      teamId: "research",
      workspacePath: "research/complete",
    })).toBe("/api/teams/research/workspace/research/complete");
    expect(resolvePath("team.agent.workspace", {
      teamId: "research",
      agentId: "scout a",
      workspacePath: "media/images",
    })).toBe("/api/teams/research/agents/scout%20a/workspace/media/images");
    expect(resolveCaviPath("cavi.operator.memory")).toBe(
      "/cavi-control/api/operator/memory",
    );
    expect(resolveCaviPath("cavi.operator.workerReady")).toBe(
      "/cavi-control/api/operator/worker/ready",
    );
    expect(resolveCaviPath("cavi.operator.workerTasks")).toBe(
      "/cavi-control/api/operator/worker/tasks",
    );
    expect(resolveCaviPath("cavi.operator.task", { taskId: "task/a b" })).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b",
    );
    expect(resolveCaviPath("cavi.operator.taskDiscourse", { taskId: "task/a b" })).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b/discourse",
    );
    expect(resolvePath("gateway.mediaProviders")).toBe("/v1/media/providers");
    expect(resolvePath("gateway.mediaAudioGenerate")).toBe(
      "/v1/media/audio/generate",
    );
    expect(resolvePath("gateway.mediaVideoGenerate")).toBe(
      "/v1/media/video/generate",
    );
    expect(resolvePath("gateway.mediaMusicGenerate")).toBe(
      "/v1/media/music/generate",
    );
    expect(resolvePath("gateway.mediaJob", {
      kind: "video",
      jobId: "job/a b",
    })).toBe("/v1/media/video/jobs/job%2Fa%20b");
    expect(resolvePath("gateway.mediaAssets", { kind: "image" })).toBe(
      "/v1/media/assets?kind=image",
    );
    expect(resolvePath("gateway.mediaAsset", {
      assetId: "asset/a b",
    })).toBe("/v1/media/assets/asset%2Fa%20b");
    expect(resolvePath("gateway.wikiVaults")).toBe("/v1/wiki/vaults");
    expect(resolvePath("gateway.wikiTree", { vaultId: "research vault" })).toBe(
      "/v1/wiki/vaults/research%20vault/tree",
    );
    expect(resolvePath("gateway.wikiRead", {
      vaultId: "research",
      path: "notes/index.qmd",
    })).toBe("/v1/wiki/vaults/research/read?path=notes%2Findex.qmd");
    expect(resolvePath("gateway.wikiIngest", { vaultId: "research" })).toBe(
      "/v1/wiki/vaults/research/ingest",
    );
    expect(resolvePath("gateway.wikiCompile", { vaultId: "research" })).toBe(
      "/v1/wiki/vaults/research/compile",
    );
    expect(resolvePath("gateway.wikiPromote", { vaultId: "research" })).toBe(
      "/v1/wiki/vaults/research/promote",
    );
  });

  it("keeps mobile portal/workspace contracts in the shared package", () => {
    // portalDashboardPath resolves ANY portal slug (manifest-supplied) — no baked allowlist.
    for (const portal of ["martina", "scout", "angela", "machine", "front-door"]) {
      expect(portalDashboardPath(portal)).toBe(
        `/api/plugins/portal/${portal}/dashboard`,
      );
    }
    expect(
      buildPortalMemoryEnvelope({
        clientId: "portal-client",
        teamSlug: "research",
        memberId: "analyst",
        memoryKey: "briefing",
        schemaContract: "BRIEFING_V1",
        payload: { ok: true },
        updatedAt: 123,
      }),
    ).toEqual({
      contract: PORTAL_MEMORY_SNAPSHOT_CONTRACT,
      clientId: "portal-client",
      teamSlug: "research",
      memberId: "analyst",
      memoryKey: "briefing",
      schemaContract: "BRIEFING_V1",
      updatedAt: 123,
      payload: { ok: true },
    });

    expect(getMobileGatewayEndpointPath("preflightCapabilities")).toBe(
      "/v1/capabilities",
    );
    expect(getMobileGatewayEndpointPath("operatorTaskDispatch")).toBe(
      "/cavi-control/api/operator/tasks",
    );
    expect(resolveOperatorTaskDispatchPath("operator-task")).toBe(
      "/cavi-control/api/operator/tasks",
    );
    expect(resolveOperatorTaskDispatchPath("kanban-native")).toBe("/api/plugins/kanban/tasks");
    expect(getMobileGatewayEndpointPath("teamWorkspace")).toBe(
      "/api/teams/research/workspace/research/complete",
    );
    expect(getMobileGatewayEndpointPath("teamAgentWorkspace")).toBe(
      "/api/teams/research/agents/analyst/workspace/media/images",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaAudio")).toBe(
      "/v1/media/audio/generate",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaVideo")).toBe(
      "/v1/media/video/generate",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaMusic")).toBe(
      "/v1/media/music/generate",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaJob")).toBe(
      "/v1/media/video/jobs/job",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaAssets")).toBe(
      "/v1/media/assets?kind=image",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaAsset")).toBe(
      "/v1/media/assets/asset",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiVaults")).toBe(
      "/v1/wiki/vaults",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiRead")).toBe(
      "/v1/wiki/vaults/default/read?path=index.qmd",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiIngest")).toBe(
      "/v1/wiki/vaults/default/ingest",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiCompile")).toBe(
      "/v1/wiki/vaults/default/compile",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiPromote")).toBe(
      "/v1/wiki/vaults/default/promote",
    );
    expect(createContractGap("preflightCapabilities", "missing auth")).toEqual({
      area: "preflight-capabilities",
      expectedContract: "/v1/capabilities",
      note: "missing auth",
      reason: "unknown",
    });
  });

  it("normalizes agnostic team manifests and resolves whitelisted workspace paths", () => {
    expect(DEFAULT_TEAM_ROUTE_KEYS).toEqual(["kanban", "runs", "config", "workspace"]);
    expect(createDefaultTeamManifest().teams[0]?.members?.[0]?.id).toBe(
      "default-agent",
    );

    const manifest = normalizeTeamManifest({
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
            rootPath: "/teams/research/workspace-research/",
            paths: ["research/complete"],
          },
          members: [
            {
              id: "scout",
              workspace: {
                rootPath: "/teams/research/workspace-research",
                paths: [{ key: "media.images", path: "media/images" }],
              },
            },
          ],
        },
      ],
    });
    const team = manifest.teams[0];
    expect(team?.identity?.aliases).toEqual(["scout-school"]);
    expect(resolveTeamRoutePath("kanban", { teamId: "research" })).toBe(
      "/api/teams/research/kanban",
    );
    expect(resolveTeamRoutePath("agent.config", {
      teamId: "research",
      agentId: "scout",
    })).toBe("/api/teams/research/agents/scout/config");
    expect(resolveTeamWorkspacePath(team!, "research/complete")).toBe(
      "/teams/research/workspace-research/research/complete",
    );
    expect(resolveTeamWorkspacePath(team!, "media.images", { memberId: "scout" })).toBe(
      "/teams/research/workspace-research/media/images",
    );
    expect(resolveTeamWorkspaceApiPath(team!, "research/complete")).toBe(
      "/api/teams/research/workspace/research/complete",
    );
    expect(resolveTeamWorkspaceApiPath(team!, "media.images", { memberId: "scout" })).toBe(
      "/api/teams/research/agents/scout/workspace/media/images",
    );
    expect(() => resolveTeamWorkspacePath(team!, "secrets/tokens")).toThrow(
      /not whitelisted/u,
    );
  });

  it("hardens team manifest ids, workspace paths, and route overrides", () => {
    expect(() =>
      normalizeTeamManifest({
        version: 1,
        teams: [{ id: "research" }, { id: "research" }],
      }),
    ).toThrow(/duplicate team "research"/u);
    expect(() =>
      normalizeTeamManifest({
        version: 1,
        teams: [
          {
            id: "research",
            members: [{ id: "scout" }, { id: "scout" }],
          },
        ],
      }),
    ).toThrow(/duplicate member "scout"/u);
    expect(() =>
      normalizeTeamManifest({
        version: 1,
        teams: [
          {
            id: "research",
            workspace: {
              rootPath: "teams/research",
              paths: ["notes"],
            },
          },
        ],
      }),
    ).toThrow(/invalid workspace rootPath/u);
    expect(() =>
      normalizeTeamManifest({
        version: 1,
        teams: [
          {
            id: "research",
            workspace: {
              rootPath: "/teams/research",
              paths: ["%2e%2e/secrets"],
            },
          },
        ],
      }),
    ).toThrow(/invalid workspace path/u);
    expect(() =>
      normalizeTeamManifest({
        version: 1,
        teams: [
          {
            id: "research",
            actions: [
              {
                id: "summarize",
                route: { path: "https://example.com/api/summarize" },
              },
            ],
          },
        ],
      }),
    ).toThrow(/invalid action route path/u);
    expect(() =>
      normalizeTeamManifest({
        version: 1,
        teams: [
          {
            id: "research",
            actions: [{ id: "summarize", route: { path: "/api/%2e%2e/secret" } }],
          },
        ],
      }),
    ).toThrow(/invalid action route path/u);
    expect(() =>
      resolvePath("team.agent.config", {
        teamId: "research",
        agentId: "scout/a",
      }),
    ).toThrow(/invalid path segment/u);
  });

  it("rejects ambiguous team registry lookup keys", () => {
    expect(() =>
      createTeamRegistry({
        teams: [
          { id: "research", teamSlug: "shared" },
          { id: "support", teamSlug: "shared" },
        ],
      }),
    ).toThrow(/ambiguous lookup key "shared"/u);
    expect(() =>
      createTeamRegistry({
        teams: [
          { id: "research", portalId: "portal" },
          { id: "support", portalId: "portal" },
        ],
      }),
    ).toThrow(/duplicate portal id "portal"/u);
  });

  it("resolves manifest route bindings for runtime channels without baked routes", () => {
    const manifest = normalizeTeamManifest({
      version: 1,
      bindings: [
        {
          id: "discord-scout",
          teamId: "research",
          memberId: "scout",
          source: "discord",
          sessionKeyPattern: "agent:{memberId}:*",
          routeKey: "agent.config",
        },
        {
          id: "teams-triage",
          teamId: "support",
          source: "teams",
          actionId: "triage",
        },
        {
          id: "custom-room",
          teamId: "support",
          channel: "community-room",
          routeKey: "runs",
        },
      ],
      teams: [
        {
          id: "research",
          members: [{ id: "scout" }],
        },
        {
          id: "support",
          actions: [{ id: "triage" }],
          members: [{ id: "helper" }],
        },
      ],
    });

    expect(resolveGatewayRouteBinding(manifest, {
      source: "discord",
      key: "agent:scout:main",
      agentId: "scout",
    })).toMatchObject({
      id: "discord-scout",
      path: "/api/teams/research/agents/scout/config",
    });
    expect(resolveGatewayRouteBinding(manifest, {
      source: "teams",
    })).toMatchObject({
      id: "teams-triage",
      path: "/api/teams/support/actions/triage",
    });
    expect(resolveGatewayRouteBinding(manifest, {
      channel: "community-room",
    })).toMatchObject({
      id: "custom-room",
      path: "/api/teams/support/runs",
    });
  });

  it("merges team action contracts from manifest, team, and agent overrides", () => {
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
          output: {
            mode: "markdown",
            contentType: "text/markdown",
          },
          defaults: {
            dark: false,
            long: false,
          },
          capabilities: ["comedy.write"],
        },
      ],
      teams: [
        {
          id: "machine",
          actions: [
            {
              id: "joke",
              input: {
                params: [
                  { key: "dark", default: true },
                  { key: "audience", type: "string", default: "degens" },
                ],
              },
              defaults: {
                long: true,
              },
            },
          ],
          members: [
            {
              id: "chris",
              actions: [
                {
                  id: "joke",
                  output: {
                    mode: "json",
                    contentType: "application/json",
                    schema: {
                      type: "object",
                      required: ["setup", "punchline"],
                    },
                  },
                  defaults: {
                    dark: true,
                    style: "degen",
                  },
                  metadata: {
                    persona: "meme-agent",
                  },
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

    expect(action).toMatchObject({
      id: "joke",
      input: {
        mode: "command",
        command: "/joke",
      },
      output: {
        mode: "json",
        contentType: "application/json",
        schema: {
          type: "object",
          required: ["setup", "punchline"],
        },
      },
      defaults: {
        dark: true,
        long: true,
        style: "degen",
      },
      metadata: {
        persona: "meme-agent",
      },
    });
    expect(action.capabilities).toEqual(["comedy.write"]);
    expect(action.input?.params?.map((param) => param.key)).toEqual([
      "topic",
      "dark",
      "audience",
    ]);
    expect(action.input?.params?.find((param) => param.key === "dark")).toMatchObject({
      key: "dark",
      type: "boolean",
      default: true,
    });
    expect(resolveTeamActionApiPath(manifest, "machine", "joke", {
      memberId: "chris",
    })).toBe("/api/teams/machine/agents/chris/actions/joke");

    const disabledManifest = normalizeTeamManifest({
      version: 1,
      actions: [{ id: "render" }],
      teams: [
        {
          id: "machine",
          members: [
            {
              id: "chris",
              actions: [{ id: "render", enabled: false }],
            },
          ],
        },
      ],
    });
    expect(resolveTeamActionContract(disabledManifest, "machine", "render", {
      memberId: "chris",
    }).enabled).toBe(false);
    expect(() =>
      resolveTeamActionApiPath(disabledManifest, "machine", "render", {
        memberId: "chris",
      }),
    ).toThrow(/disabled/u);
  });

  it("throws for unknown surface and missing required path params", () => {
    expect(() => resolvePath("nope.surface")).toThrow('resolvePath: unknown surface "nope.surface"');
    expect(() => resolveCaviPath("portal.dashboard", { portal: "" })).toThrow(
      'CAVI_SURFACE_CONTRACTS: missing path param "portal"',
    );
    expect(() => resolveCaviPath("cavi.operator.task")).toThrow(
      'CAVI_SURFACE_CONTRACTS: missing path param "taskId"',
    );
    expect(() => resolvePath("team.agent.config", { teamId: "research" })).toThrow(
      'SURFACE_CONTRACTS: missing path param "agentId"',
    );
  });

  it("centralizes auth, client id, idempotency, credentials, and subclass header overrides", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const trace = vi.fn();
    const client = new HeaderOverrideClient({
      baseUrl: "https://api.example/",
      auth: { bearerToken: "test-token", clientId: "client-1" },
      credentials: "include",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onTrace: trace,
    });

    await expect(client.get("items", { method: "POST", body: { a: 1 }, idempotencyKey: "idem-1" })).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.example/items");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      cache: "no-store",
      credentials: "include",
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-1",
      "X-Override": "yes",
      "X-Portal-Client-Id": "client-1",
    });
    expect(trace).toHaveBeenCalledWith(expect.objectContaining({ ok: true, path: "/items" }));
  });

  it("keeps request timeouts active when callers pass their own abort signal", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    const trace = vi.fn();
    const client = new TestApiClient({
      baseUrl: "https://api.example",
      defaultTimeoutMs: 50,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onTrace: trace,
    });

    const assertion = expect(
      client.get("/slow", { signal: callerController.signal }),
    ).rejects.toMatchObject({
      name: "HttpApiError",
      path: "/slow",
      status: 0,
    });
    await vi.advanceTimersByTimeAsync(51);

    await assertion;
    expect(callerController.signal.aborted).toBe(false);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).not.toBe(callerController.signal);
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        path: "/slow",
      }),
    );
  });

  it("honors caller abort signals before the package timeout fires", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("caller cancelled", "AbortError"));
          });
        }),
    );
    const client = new TestApiClient({
      baseUrl: "https://api.example",
      defaultTimeoutMs: 10_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const assertion = expect(
      client.get("/cancelled", { signal: callerController.signal }),
    ).rejects.toBe("caller cancelled");
    callerController.abort("caller cancelled");
    await vi.advanceTimersByTimeAsync(0);

    await assertion;
  });

  it("does not replace a timeout abort when the caller aborts before rejection handling", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation timed out.", "AbortError"));
          });
        }),
    );
    const client = new TestApiClient({
      baseUrl: "https://api.example",
      defaultTimeoutMs: 50,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const request = client.get("/timeout-first", { signal: callerController.signal });
    vi.advanceTimersByTime(51);
    callerController.abort("late cancellation");

    await expect(request).rejects.toMatchObject({
      name: "HttpApiError",
      path: "/timeout-first",
      status: 0,
      message: expect.stringContaining("timed out"),
    });
  });

  it("removes the exact caller abort listener and clears the timeout after completion", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const add = vi.spyOn(callerController.signal, "addEventListener");
    const remove = vi.spyOn(callerController.signal, "removeEventListener");
    const client = new TestApiClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch,
    });

    await expect(client.get("/complete", { signal: callerController.signal })).resolves.toEqual({});

    const abortListener = add.mock.calls.find(([type]) => type === "abort")?.[1];
    expect(abortListener).toEqual(expect.any(Function));
    expect(remove).toHaveBeenCalledWith("abort", abortListener);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not mask a fetch failure when the caller aborts before rejection handling", async () => {
    const callerController = new AbortController();
    let rejectFetch: ((reason?: unknown) => void) | undefined;
    const fetchImpl = vi.fn(
      () => new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
      }),
    );
    const client = new TestApiClient({
      baseUrl: "https://api.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const request = client.get("/network-failure", { signal: callerController.signal });
    rejectFetch?.(new Error("network failed"));
    callerController.abort("late cancellation");

    await expect(request).rejects.toMatchObject({
      name: "HttpApiError",
      path: "/network-failure",
      status: 0,
      message: expect.stringContaining("network failed"),
    });
  });

  it("uses inherited transport for library search", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const client = new LibraryApiClient({ baseUrl: "https://api.example", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.search({ q: "research", archived: false })).resolves.toEqual({ results: [] });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.example/api/plugins/library/search?q=research&archived=false");
  });

  it("uses canonical API-first portal routes by default", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new PortalApiClient({
      baseUrl: "https://gateway.example",
      portalId: "martina",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.getDashboard()).resolves.toEqual({ ok: true });
    await expect(client.getFromPortal("runs")).resolves.toEqual({ ok: true });

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://gateway.example/api/plugins/portal/martina/dashboard",
      "https://gateway.example/api/plugins/portal/martina/runs",
    ]);
  });

  it("keeps targeted fleet-router chat runs on the gateway run surface", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            run_id: "run_1",
            status: "started",
            routing: {
              targetProfile: "martina",
              taskId: "task_1",
              workerEventStream: true,
            },
          }),
          { status: 202 },
        ),
    );
    const client = new GatewayApiClient({
      baseUrl: "https://gateway.example",
      auth: { bearerToken: "test-token", clientId: "cavi-control-mobile" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.startRun({
        input: "show my workspace queue",
        session_id: "mobile-session-1",
        sessionKey: "mobile-session-1",
        session_key: "mobile-session-1",
        targetProfile: "martina",
        target_agent: "martina",
        source: {
          platform: "mobile_app",
          app_env: "cavi-control-mobile",
          conversation_id: "thread-1",
        },
        metadata: { mobileMessageId: "msg-1" },
        attachments: [{ name: "note.txt", mimeType: "text/plain", dataBase64: "aGVsbG8=" }],
      }),
    ).resolves.toMatchObject({
      run_id: "run_1",
      routing: {
        targetProfile: "martina",
        taskId: "task_1",
        workerEventStream: true,
      },
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://gateway.example/v1/runs");
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "X-Portal-Client-Id": "cavi-control-mobile",
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      input: "show my workspace queue",
      session_id: "mobile-session-1",
      sessionKey: "mobile-session-1",
      session_key: "mobile-session-1",
      targetProfile: "martina",
      target_agent: "martina",
      source: {
        platform: "mobile_app",
        app_env: "cavi-control-mobile",
        conversation_id: "thread-1",
      },
      metadata: { mobileMessageId: "msg-1" },
      attachments: [{ name: "note.txt", mimeType: "text/plain", dataBase64: "aGVsbG8=" }],
    });
  });

  it("normalizes gateway feature capabilities from the API client", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            features: {
              media: { video: true },
              rpcMethods: ["runs.stop"],
            },
          }),
          { status: 200 },
        ),
    );
    const client = new GatewayApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.getFeatureCapabilities()).resolves.toMatchObject({
      media: true,
      mediaKinds: {
        audio: false,
        image: false,
        video: true,
        music: false,
      },
      rpc: true,
      rpcMethods: ["runs.stop"],
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://gateway.example/v1/capabilities");
  });

  it("exposes OpenClaw's native RPC capability contract with no CAVI plugin assumed", async () => {
    const fetchImpl = vi.fn();
    const client = new OpenClawApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const features = await client.getFeatureCapabilities();
    expect(features).toMatchObject({
      rpc: true,
      websocket: true,
      // Capability advertisement = `hello-ok.features.methods` per the upstream
      // doc — advertised subset only. `sessions.resolve` / `sessions.steer` are
      // unadvertised in the manifest and must NOT appear here.
      rpcMethods: expect.arrayContaining([
        "sessions.list",
        "sessions.patch",
        "agent.wait",
        "logs.tail",
        "chat.send",
        "models.list",
      ]),
    });
    // The operator plane is plugin-gated: the base provider must not advertise it.
    expect(features.rpcMethods).not.toContain("operator.snapshot");

    const caps = await client.getCapabilities();
    expect(caps).toMatchObject({
      platform: "openclaw",
      endpoints: {
        health: { method: "GET", path: "/health" },
        ready: { method: "GET", path: "/readyz" },
      },
    });
    expect(caps.endpoints?.caviOperatorSnapshot).toBeUndefined();
    expect(caps.features.caviControlOperator).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses current OpenClaw WebSocket RPC methods for run operations", async () => {
    const fetchImpl = vi.fn();
    const request = vi.fn(
      async (method: string, params?: Record<string, unknown>) => {
        if (method === OPENCLAW_RPC_METHODS.chatSend) {
          expect(params).toMatchObject({
            sessionKey: "mobile-session-1",
            sessionId: "mobile-session-1",
            message: "show my workspace queue",
            idempotencyKey: "msg-1",
            attachments: [
              {
                name: "note.txt",
                mimeType: "text/plain",
                dataBase64: "aGVsbG8=",
              },
            ],
          });
          return { runId: "run_1", status: "started", sessionKey: "mobile-session-1" };
        }
        if (method === OPENCLAW_RPC_METHODS.agentWait) {
          expect(params).toEqual({ runId: "run_1", timeoutMs: 0 });
          return { runId: "run_1", status: "completed" };
        }
        if (method === OPENCLAW_RPC_METHODS.sessionsAbort) {
          expect(params).toEqual({ runId: "run_1" });
          return { ok: true, aborted: true };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    );
    const client = new OpenClawApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      rpcClient: { request },
    });

    await expect(
      client.startRun({
        input: "show my workspace queue",
        session_id: "mobile-session-1",
        sessionKey: "mobile-session-1",
        metadata: { mobileMessageId: "msg-1" },
        attachments: [{ name: "note.txt", mimeType: "text/plain", dataBase64: "aGVsbG8=" }],
      }),
    ).resolves.toMatchObject({
      run_id: "run_1",
      status: "started",
      session_id: "mobile-session-1",
    });
    await expect(client.getRun("run_1")).resolves.toMatchObject({
      run_id: "run_1",
      status: "completed",
    });
    await expect(client.stopRun("run_1")).resolves.toEqual({ status: "aborted" });
    await expect(
      client.resolveRunApproval("run_1", { approved: true }),
    ).rejects.toThrow(/does not expose/u);

    expect(request.mock.calls.map((call) => call[0])).toEqual([
      OPENCLAW_RPC_METHODS.chatSend,
      OPENCLAW_RPC_METHODS.agentWait,
      OPENCLAW_RPC_METHODS.sessionsAbort,
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("layers the CAVI Control operator plane onto provider capabilities via the extension (plugin-gated)", async () => {
    const client = new OpenClawApiClient({ baseUrl: "https://gateway.example" });
    const augmented = withCaviControlOperatorCapabilities(
      await client.getCapabilities(),
    );

    expect(augmented.features.caviControlOperator).toBe(true);
    expect(augmented.endpoints?.caviOperatorSnapshot).toEqual({
      method: "GET",
      path: "/cavi-control/api/operator/snapshot",
    });
    expect(augmented.rpcMethods).toEqual(
      expect.arrayContaining(["operator.snapshot", "operator.tasks.list"]),
    );
  });

  it("uses one gateway media interface across generic, Hermes, and OpenClaw providers", async () => {
    let waitJobRequests = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? "GET";
      const headers = init?.headers as Record<string, string> | undefined;
      if (requestUrl.endsWith("/v1/media/audio/providers")) {
        return new Response(
          JSON.stringify({
            providers: [{ id: "voice-lab", kind: "audio", configured: true }],
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/media/music/generate")) {
        return new Response(
          JSON.stringify({
            id: "media_1",
            kind: "music",
            status: "queued",
            metadata: { accepted: true },
          }),
          { status: 202 },
        );
      }
      if (requestUrl.endsWith("/v1/media/image/generate")) {
        return new Response(
          JSON.stringify({
            id: "image_1",
            kind: "image",
            status: "queued",
          }),
          { status: 202 },
        );
      }
      if (requestUrl.endsWith("/v1/media/audio/generate")) {
        return new Response(
          JSON.stringify({
            id: "tts_1",
            kind: "audio",
            status: "queued",
          }),
          { status: 202 },
        );
      }
      if (requestUrl.endsWith("/v1/media/video/jobs/job%2Fa%20b")) {
        return new Response(
          JSON.stringify({
            id: "job/a b",
            kind: "video",
            status: "running",
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/media/video/jobs/wait%20job")) {
        waitJobRequests += 1;
        return new Response(
          JSON.stringify({
            id: "wait job",
            kind: "video",
            status: waitJobRequests === 1 ? "running" : "completed",
            asset: waitJobRequests === 1 ? undefined : { id: "video_1", kind: "video" },
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/media/assets?kind=image") && method === "GET") {
        return new Response(
          JSON.stringify({
            kind: "image",
            assets: [{ id: "asset/a b", kind: "image", contentType: "image/png" }],
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/media/assets?kind=image") && method === "POST") {
        return new Response(
          JSON.stringify({
            id: "upload_1",
            kind: "image",
            filename: "cover.png",
            contentType: "image/png",
          }),
          { status: 201 },
        );
      }
      if (
        requestUrl.endsWith("/v1/media/assets/asset%2Fa%20b") &&
        method === "DELETE"
      ) {
        return new Response(
          JSON.stringify({ id: "asset/a b", deleted: true, status: "deleted" }),
          { status: 200 },
        );
      }
      if (
        requestUrl.endsWith("/v1/media/assets/asset%2Fa%20b") &&
        headers?.Accept === "application/json"
      ) {
        return new Response(
          JSON.stringify({
            id: "asset/a b",
            kind: "image",
            contentType: "image/png",
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/media/assets/asset%2Fa%20b")) {
        return new Response("asset-bytes", {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      return new Response(JSON.stringify({ status: "ok", init }), { status: 200 });
    });
    const generic = new GatewayMediaApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const hermes = createGatewayMediaClient(
      { baseUrl: "https://gateway.example", fetchImpl: fetchImpl as unknown as typeof fetch },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclaw = createGatewayMediaClient(
      { baseUrl: "https://gateway.example", fetchImpl: fetchImpl as unknown as typeof fetch },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
    );

    expect(generic.surface).toBe("gateway-media-api");
    expect(GATEWAY_MEDIA_KINDS).toContain("image");
    expect(hermes).toBeInstanceOf(HermesMediaApiClient);
    expect(hermes.surface).toBe("hermes-media-api");
    expect(openclaw).toBeInstanceOf(OpenClawMediaApiClient);
    expect(openclaw.surface).toBe("openclaw-media-api");
    await expect(generic.listMediaProviders("audio")).resolves.toEqual({
      providers: [{ id: "voice-lab", kind: "audio", configured: true }],
    });
    await expect(hermes.generateMusic({
      input: "lofi market open loop",
      options: { bpm: 90 },
    }, "media-1")).resolves.toMatchObject({
      id: "media_1",
      kind: "music",
      status: "queued",
    });
    await expect(generic.generateImage({
      input: "cover art for the research dashboard",
      format: "png",
    })).resolves.toMatchObject({
      id: "image_1",
      kind: "image",
      status: "queued",
    });
    await expect(generic.generateTextToSpeech({
      text: "Status report ready",
      voiceId: "voice-1",
      format: "mp3",
    }, "tts-1")).resolves.toMatchObject({
      id: "tts_1",
      kind: "audio",
      status: "queued",
    });
    // OpenClaw core does not expose a media job polling RPC — the dispatcher
    // throws EndpointNotFound until a plugin manifest registers job routes.
    await expect(openclaw.getMediaJob("video", "job/a b")).rejects.toThrow(
      /openclaw: getMediaJob is not part of the core OpenClaw RPC surface/,
    );
    await expect(generic.waitForMediaJob("video", "wait job", {
      intervalMs: 1,
      sleep: async () => undefined,
    })).resolves.toMatchObject({
      id: "wait job",
      status: "completed",
      asset: { id: "video_1", kind: "video" },
    });
    await expect(generic.listMediaAssets({ kind: "image" })).resolves.toEqual({
      kind: "image",
      assets: [{ id: "asset/a b", kind: "image", contentType: "image/png" }],
    });
    await expect(generic.uploadMediaAsset({
      kind: "image",
      filename: "cover.png",
      contentType: "image/png",
      dataBase64: "aW1hZ2U=",
    }, "asset-1")).resolves.toMatchObject({
      id: "upload_1",
      kind: "image",
    });
    await expect(generic.getMediaAssetMetadata("asset/a b")).resolves.toMatchObject({
      id: "asset/a b",
      kind: "image",
      contentType: "image/png",
    });
    const asset = await generic.getImageAsset("asset/a b");
    await expect(generic.deleteMediaAsset("asset/a b")).resolves.toMatchObject({
      id: "asset/a b",
      deleted: true,
      status: "deleted",
    });

    expect(await asset.text()).toBe("asset-bytes");
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://gateway.example/v1/media/audio/providers",
      "https://gateway.example/v1/media/music/generate",
      "https://gateway.example/v1/media/image/generate",
      "https://gateway.example/v1/media/audio/generate",
      // OpenClaw getMediaJob is gated (EndpointNotFound) until the plugin
      // manifest registers job routes — no fetch is issued for it.
      "https://gateway.example/v1/media/video/jobs/wait%20job",
      "https://gateway.example/v1/media/video/jobs/wait%20job",
      "https://gateway.example/v1/media/assets?kind=image",
      "https://gateway.example/v1/media/assets?kind=image",
      "https://gateway.example/v1/media/assets/asset%2Fa%20b",
      "https://gateway.example/v1/media/assets/asset%2Fa%20b",
      "https://gateway.example/v1/media/assets/asset%2Fa%20b",
    ]);
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        input: "lofi market open loop",
        options: { bpm: 90 },
        kind: "music",
      }),
    });
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": "media-1",
    });
    expect(fetchImpl.mock.calls[3]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        voiceId: "voice-1",
        format: "mp3",
        input: "Status report ready",
        kind: "audio",
      }),
    });
    expect(fetchImpl.mock.calls[3]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": "tts-1",
    });
    // Indices shifted down by one because OpenClaw getMediaJob is now gated
    // and does not issue a fetch (was originally between audio/generate and the
    // waitForMediaJob polls at index 4).
    expect(fetchImpl.mock.calls[7]?.[1]).toMatchObject({
      method: "POST",
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[7]?.[1]?.body))).toEqual({
      kind: "image",
      filename: "cover.png",
      contentType: "image/png",
      dataBase64: "aW1hZ2U=",
    });
    expect(fetchImpl.mock.calls[7]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": "asset-1",
    });
    expect(fetchImpl.mock.calls[8]?.[1]?.headers).toMatchObject({
      Accept: "application/json",
    });
    expect(fetchImpl.mock.calls[9]?.[1]?.headers).toMatchObject({
      Accept: "image/*",
    });
    expect(fetchImpl.mock.calls[10]?.[1]).toMatchObject({ method: "DELETE" });
    expect(() =>
      generic.generateMedia({ kind: "document" as never, input: "cover art" }),
    ).toThrow(/unsupported media kind/u);
    expect(() =>
      generic.uploadMediaAsset({ kind: "image", filename: "cover.png" }),
    ).toThrow(/missing media asset source/u);
    expect(() => generic.listMediaAssets({ limit: 0 })).toThrow(
      /positive integer/u,
    );
  });

  it("uses one gateway wiki interface across generic, Hermes, and OpenClaw providers", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/v1/wiki/vaults")) {
        return new Response(
          JSON.stringify({
            vaults: [{ id: "research", defaultFormat: "qmd" }],
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/wiki/vaults/research/tree")) {
        return new Response(
          JSON.stringify({
            vaultId: "research",
            entries: [{ path: "index.qmd", kind: "file", format: "qmd" }],
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/wiki/vaults/research/read?path=index.qmd")) {
        return new Response(
          JSON.stringify({
            vaultId: "research",
            path: "index.qmd",
            format: "qmd",
            content: "# Research",
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/wiki/vaults/research/ingest")) {
        return new Response(
          JSON.stringify({ jobId: "ingest_1", vaultId: "research", status: "queued" }),
          { status: 202 },
        );
      }
      if (requestUrl.endsWith("/v1/wiki/vaults/research/compile")) {
        return new Response(
          JSON.stringify({
            jobId: "compile_1",
            vaultId: "research",
            status: "running",
          }),
          { status: 202 },
        );
      }
      if (requestUrl.endsWith("/v1/wiki/vaults/research/promote")) {
        return new Response(
          JSON.stringify({
            jobId: "promote_1",
            vaultId: "research",
            status: "completed",
            outputPath: "published/index.qmd",
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/wiki/vaults/research/jobs/compile%2F1")) {
        return new Response(
          JSON.stringify({
            jobId: "compile/1",
            vaultId: "research",
            status: "completed",
            artifactId: "artifact_1",
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/wiki/vaults/research/artifacts/artifact%2F1")) {
        return new Response("qmd-artifact", {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        });
      }
      return new Response(JSON.stringify({ status: "ok", init }), { status: 200 });
    });
    const generic = new GatewayWikiApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const hermes = createGatewayWikiClient(
      { baseUrl: "https://gateway.example", fetchImpl: fetchImpl as unknown as typeof fetch },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclaw = createGatewayWikiClient(
      { baseUrl: "https://gateway.example", fetchImpl: fetchImpl as unknown as typeof fetch },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
    );

    expect(generic.surface).toBe("gateway-wiki-api");
    expect(hermes).toBeInstanceOf(HermesWikiApiClient);
    expect(hermes.surface).toBe("hermes-wiki-api");
    expect(openclaw).toBeInstanceOf(OpenClawWikiApiClient);
    expect(openclaw.surface).toBe("openclaw-wiki-api");
    await expect(generic.listWikiVaults()).resolves.toEqual({
      vaults: [{ id: "research", defaultFormat: "qmd" }],
    });
    await expect(generic.getWikiTree("research")).resolves.toMatchObject({
      vaultId: "research",
      entries: [{ path: "index.qmd", kind: "file", format: "qmd" }],
    });
    await expect(generic.readWikiPage("research", "index.qmd")).resolves.toMatchObject({
      vaultId: "research",
      path: "index.qmd",
      content: "# Research",
    });
    await expect(hermes.ingestWiki("research", {
      path: "drafts/inbox.qmd",
      content: "# Inbox",
      format: "qmd",
    }, "wiki-ingest-1")).resolves.toMatchObject({
      jobId: "ingest_1",
      status: "queued",
    });
    // OpenClaw core does not expose a wiki RPC namespace — the dispatcher
    // throws EndpointNotFound until a wiki plugin manifest registers routes.
    await expect(openclaw.compileWiki("research", {
      path: "index.qmd",
      target: "html",
    })).rejects.toThrow(
      /openclaw: compileWiki is not part of the core OpenClaw surface/,
    );
    await expect(generic.promoteWiki("research", {
      sourcePath: "drafts/inbox.qmd",
      targetPath: "published/index.qmd",
    })).resolves.toMatchObject({
      jobId: "promote_1",
      status: "completed",
      outputPath: "published/index.qmd",
    });
    await expect(generic.getWikiJob("research", "compile/1")).resolves.toMatchObject({
      jobId: "compile/1",
      artifactId: "artifact_1",
      status: "completed",
    });
    const artifact = await generic.getWikiArtifact("research", "artifact/1", {
      accept: "text/markdown",
    });

    expect(await artifact.text()).toBe("qmd-artifact");
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://gateway.example/v1/wiki/vaults",
      "https://gateway.example/v1/wiki/vaults/research/tree",
      "https://gateway.example/v1/wiki/vaults/research/read?path=index.qmd",
      "https://gateway.example/v1/wiki/vaults/research/ingest",
      // OpenClaw compileWiki is gated (EndpointNotFound) — no fetch issued.
      "https://gateway.example/v1/wiki/vaults/research/promote",
      "https://gateway.example/v1/wiki/vaults/research/jobs/compile%2F1",
      "https://gateway.example/v1/wiki/vaults/research/artifacts/artifact%2F1",
    ]);
    expect(fetchImpl.mock.calls[3]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        path: "drafts/inbox.qmd",
        content: "# Inbox",
        format: "qmd",
      }),
    });
    expect(fetchImpl.mock.calls[3]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": "wiki-ingest-1",
    });
    // Shifted from [7] down to [6] because OpenClaw compileWiki is gated
    // (EndpointNotFound) and does not issue a fetch.
    expect(fetchImpl.mock.calls[6]?.[1]?.headers).toMatchObject({
      Accept: "text/markdown",
    });
    expect(() => generic.readWikiPage("research", " ")).toThrow(/missing wiki page path/u);
  });

  it("uses core SSE and WebSocket transports with provider adapters", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/v1/runs/run%2F1/events")) {
        return new Response(
          `data: ${JSON.stringify({
            event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
            run_id: "run/1",
            delta: "hello",
          })}\n\n`,
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        );
      }
      return new Response(JSON.stringify({ status: "completed", run_id: "run/1" }), {
        status: 200,
      });
    });
    const events: unknown[] = [];
    const provider = new GatewaySseRunEventProvider({
      httpBase: "https://gateway.example/",
      authToken: "test-token",
      clientId: "client-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await new Promise<void>((resolve, reject) => {
      void provider.subscribe(
        { runId: "run/1" },
        {
          onEvent: (event) => events.push(event),
          onError: reject,
          onComplete: resolve,
        },
      );
    });

    expect(events).toEqual([
      {
        event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
        runId: "run/1",
        delta: "hello",
        at: undefined,
      },
    ]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://gateway.example/v1/runs/run%2F1/events",
    );
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Accept: "text/event-stream",
      Authorization: "Bearer test-token",
      "X-Portal-Client-Id": "client-1",
    });

    const hermes = createGatewaySseRunEventProvider(
      {
        httpBase: "https://gateway.example",
        authToken: "test-token",
        clientId: "client-1",
        sessionKey: "session-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    await new Promise<void>((resolve, reject) => {
      void hermes.subscribe(
        { runId: "run/1" },
        {
          onEvent: () => undefined,
          onError: reject,
          onComplete: resolve,
        },
      );
    });
    const openclaw = createGatewaySseRunEventProvider(
      {
        httpBase: "https://gateway.example",
        authToken: "test-token",
        clientId: "client-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const hermesWs = createGatewayWebSocketClient(
      "wss://gateway.example/api/ws",
      "test-token",
      { clientId: "client-1" },
      { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
    );
    const openclawWs = createGatewayWebSocketClient(
      "wss://gateway.example/ws",
      "test-token",
      { clientId: "client-1" },
      { provider: "openclaw", providerModules: BUILT_IN_PROVIDER_MODULES },
    );

    expect(hermes).toBeInstanceOf(HermesSseRunEventProvider);
    expect(openclaw).toBeInstanceOf(OpenClawSseRunEventProvider);
    expect(hermesWs).toBeInstanceOf(HermesWebSocketClient);
    expect(openclawWs).toBeInstanceOf(OpenClawWebSocketClient);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({
      "X-Hermes-Session-Key": "session-1",
    });
    const openclawErrors: unknown[] = [];
    const openclawSubscription = await openclaw.subscribe(
      { runId: "run/1" },
      {
        onEvent: () => undefined,
        onError: (error) => openclawErrors.push(error),
      },
    );
    await Promise.resolve();
    expect(openclawErrors[0]).toBeInstanceOf(Error);
    expect(String((openclawErrors[0] as Error).message)).toContain(
      "WebSocket JSON-RPC",
    );
    expect(getErrorCode(openclawErrors[0])).toBe(ApiClientErrorCode.EndpointNotFound);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await openclawSubscription.dispose();
    expect(() =>
      createGatewaySseRunEventProvider(
        {
          httpBase: "https://gateway.example",
          authToken: "test-token",
          clientId: "client-1",
        },
        { provider: "hermes", providerModules: BUILT_IN_PROVIDER_MODULES },
      ),
    ).toThrow(/sessionKey/u);
  });
});

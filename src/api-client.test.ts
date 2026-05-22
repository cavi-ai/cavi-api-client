import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseHttpApiClient } from "./core/http/client";
import { resolveHttpApiConfigFromEnv } from "./core/env/config";
import { resolveHermesHttpApiConfigFromEnv } from "./providers/hermes/env-config";
import {
  appendHttpQuery,
  CAVI_CONTROL_API_ENDPOINTS,
  GATEWAY_MEDIA_API_ENDPOINTS,
  GATEWAY_WIKI_API_ENDPOINTS,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
  LIBRARY_API_ENDPOINTS,
  OPERATOR_DISPATCH_ENDPOINTS,
  resolveLibraryApiPath,
} from "./contracts/paths";
import {
  GatewayApiClient,
  GatewayMediaApiClient,
  GatewaySseRunEventProvider,
  GatewayWikiApiClient,
  GATEWAY_MEDIA_KINDS,
  GATEWAY_WIKI_FORMATS,
  HermesMediaApiClient,
  HermesSseRunEventProvider,
  HermesWebSocketClient,
  HermesWikiApiClient,
  MOBILE_GATEWAY_ENDPOINT_CONTRACTS,
  OpenClawMediaApiClient,
  OpenClawSseRunEventProvider,
  OpenClawWebSocketClient,
  OpenClawWikiApiClient,
  PortalApiClient,
  PORTAL_DASHBOARD_IDS,
  RUN_STREAM_EVENT_NAMES,
  createContractGap,
  createDefaultTeamManifest,
  createGatewayMediaClient,
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
  createGatewayWikiClient,
  getMobileGatewayEndpointPath,
  normalizeTeamManifest,
  portalDashboardPath,
  resolveOperatorTaskDispatchPath,
  SURFACE_CONTRACTS,
  resolvePath,
  resolveTeamActionApiPath,
  resolveTeamActionContract,
  resolveTeamRoutePath,
  resolveTeamWorkspaceApiPath,
  resolveTeamWorkspacePath,
  DEFAULT_TEAM_ROUTE_KEYS,
} from "./index";
import { LibraryApiClient } from "./cavi/library/client";
import type { HttpApiClientOptions, HttpApiRequestInit } from "./core/http/types";

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
      "/api/plugins/cavi-control/operator",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.task("task/a b")).toBe(
      "/api/plugins/cavi-control/operator/tasks/task%2Fa%20b",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.taskDiscourse("task/a b")).toBe(
      "/api/plugins/cavi-control/operator/tasks/task%2Fa%20b/discourse",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.portals.martina.artifactPreview("docs", "a b.md")).toBe(
      "/api/plugins/portal/martina/artifacts/docs/a%20b.md/preview",
    );
    expect(HERMES_API_ENDPOINTS.runApproval("run/1")).toBe("/v1/runs/run%2F1/approval");
    expect(HERMES_API_ENDPOINT_TEMPLATES.runApproval).toBe("/v1/runs/{run_id}/approval");
    expect(HERMES_API_ENDPOINT_TEMPLATES.ecgSharedFiles).toBe("/api/v1/files?agent={agent}&folder={folder}");
    expect(GATEWAY_MEDIA_KINDS).toEqual(["audio", "video", "music"]);
    expect(GATEWAY_MEDIA_API_ENDPOINTS.providers()).toBe("/v1/media/providers");
    expect(GATEWAY_MEDIA_API_ENDPOINTS.providers("audio")).toBe(
      "/v1/media/audio/providers",
    );
    expect(GATEWAY_MEDIA_API_ENDPOINTS.generate("music")).toBe(
      "/v1/media/music/generate",
    );
    expect(GATEWAY_MEDIA_API_ENDPOINTS.job("video", "job/a b")).toBe(
      "/v1/media/video/jobs/job%2Fa%20b",
    );
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
    expect(LIBRARY_API_ENDPOINTS.document("doc/1")).toBe("/library/api/documents/doc%2F1");
    expect(LIBRARY_API_ENDPOINTS.fleetStatus).toBe("/library/api/fleet-status");
    expect(LIBRARY_API_ENDPOINTS.status).toBe("/library/api/status");
    expect(LIBRARY_API_ENDPOINTS.inbox).toBe("/library/api/inbox");
    expect(LIBRARY_API_ENDPOINTS.promotable).toBe("/library/api/promotable");
    expect(LIBRARY_API_ENDPOINTS.reviewRequests).toBe("/library/api/review-requests");
    expect(resolveLibraryApiPath("search")).toBe("/library/api/search");
    expect(resolveLibraryApiPath("/library/api/search")).toBe("/library/api/search");
    expect(appendHttpQuery("/library/api/search", { q: "top 10", page: 2, skip: undefined })).toBe(
      "/library/api/search?q=top+10&page=2",
    );
  });

  it("resolves surface paths in legacy and canonical modes", () => {
    expect(SURFACE_CONTRACTS["portal.dashboard"]?.method).toBe("GET");
    expect(resolvePath("portal.dashboard", "legacy", { portal: "martina" })).toBe(
      "/martina/api/dashboard",
    );
    expect(resolvePath("portal.dashboard", "canonical", { portal: "martina" })).toBe(
      "/api/plugins/portal/martina/dashboard",
    );
    expect(resolvePath("machine.media", "legacy", { filename: "a/b c.png" })).toBe(
      "/machine/api/media?name=a%2Fb%20c.png",
    );
    expect(resolvePath("cavi.deb.root", "legacy")).toBe("/cavi-control/api/deb");
    expect(resolvePath("cavi.deb.profile", "canonical")).toBe("/api/plugins/cavi-control/deb/profile");
    expect(resolvePath("cavi.deb.sprint", "legacy")).toBe("/cavi-control/api/deb/sprint");
    expect(resolvePath("cavi.deb.backlog", "canonical")).toBe("/api/plugins/cavi-control/deb/backlog");
    expect(resolvePath("cavi.deb.call", "canonical")).toBe("/api/plugins/cavi-control/deb/call");
    expect(resolvePath("cavi.operator.registry", "legacy")).toBe(
      "/cavi-control/api/operator/registry",
    );
    expect(resolvePath("cavi.operator.snapshot", "canonical")).toBe(
      "/api/plugins/cavi-control/operator/snapshot",
    );
    expect(resolvePath("kanban.board", "canonical")).toBe("/api/plugins/kanban/board");
    expect(resolvePath("team.kanban", "canonical", { teamId: "research team" })).toBe(
      "/api/teams/research%20team/kanban",
    );
    expect(resolvePath("team.agent.config", "canonical", {
      teamId: "research",
      agentId: "scout/a",
    })).toBe("/api/teams/research/agents/scout%2Fa/config");
    expect(resolvePath("team.action", "canonical", {
      teamId: "machine",
      actionId: "joke/dark",
    })).toBe("/api/teams/machine/actions/joke%2Fdark");
    expect(resolvePath("team.agent.action", "canonical", {
      teamId: "machine",
      agentId: "chris/a",
      actionId: "joke",
    })).toBe("/api/teams/machine/agents/chris%2Fa/actions/joke");
    expect(resolvePath("team.workspace", "canonical", {
      teamId: "research",
      workspacePath: "research/complete",
    })).toBe("/api/teams/research/workspace/research/complete");
    expect(resolvePath("team.agent.workspace", "canonical", {
      teamId: "research",
      agentId: "scout/a",
      workspacePath: "media/images",
    })).toBe("/api/teams/research/agents/scout%2Fa/workspace/media/images");
    expect(resolvePath("cavi.operator.memory", "canonical")).toBe(
      "/api/plugins/cavi-control/operator/memory",
    );
    expect(resolvePath("cavi.operator.workerReady", "legacy")).toBe(
      "/cavi-control/api/operator/worker/ready",
    );
    expect(resolvePath("cavi.operator.workerTasks", "canonical")).toBe(
      "/api/plugins/cavi-control/operator/worker/tasks",
    );
    expect(resolvePath("cavi.operator.task", "legacy", { taskId: "task/a b" })).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b",
    );
    expect(resolvePath("cavi.operator.taskDiscourse", "canonical", { taskId: "task/a b" })).toBe(
      "/api/plugins/cavi-control/operator/tasks/task%2Fa%20b/discourse",
    );
    expect(resolvePath("gateway.mediaProviders", "canonical")).toBe("/v1/media/providers");
    expect(resolvePath("gateway.mediaAudioGenerate", "canonical")).toBe(
      "/v1/media/audio/generate",
    );
    expect(resolvePath("gateway.mediaVideoGenerate", "canonical")).toBe(
      "/v1/media/video/generate",
    );
    expect(resolvePath("gateway.mediaMusicGenerate", "canonical")).toBe(
      "/v1/media/music/generate",
    );
    expect(resolvePath("gateway.wikiVaults", "canonical")).toBe("/v1/wiki/vaults");
    expect(resolvePath("gateway.wikiTree", "canonical", { vaultId: "research vault" })).toBe(
      "/v1/wiki/vaults/research%20vault/tree",
    );
    expect(resolvePath("gateway.wikiRead", "canonical", {
      vaultId: "research",
      path: "notes/index.qmd",
    })).toBe("/v1/wiki/vaults/research/read?path=notes%2Findex.qmd");
    expect(resolvePath("gateway.wikiIngest", "canonical", { vaultId: "research" })).toBe(
      "/v1/wiki/vaults/research/ingest",
    );
    expect(resolvePath("gateway.wikiCompile", "canonical", { vaultId: "research" })).toBe(
      "/v1/wiki/vaults/research/compile",
    );
    expect(resolvePath("gateway.wikiPromote", "canonical", { vaultId: "research" })).toBe(
      "/v1/wiki/vaults/research/promote",
    );

    expect(SURFACE_CONTRACTS["frontDoor.ideaList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.ideaCreate"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.ideaDetail"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.ideaPatch"]?.method).toBe("PATCH");
    expect(SURFACE_CONTRACTS["frontDoor.ideaPromote"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.projectList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.projectDetail"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.articleList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.articleCreate"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.memoryList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.memoryCreate"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.inboxUpload"]?.method).toBe("POST");

    expect(resolvePath("frontDoor.ideaList", "canonical")).toBe("/api/plugins/front-door/ideas");
    expect(resolvePath("frontDoor.ideaDetail", "canonical", { id: "idea/a b" })).toBe(
      "/api/plugins/front-door/ideas/idea%2Fa%20b",
    );
    expect(resolvePath("frontDoor.projectDetail", "legacy", { id: "proj/a b" })).toBe(
      "/front-door/api/projects/proj%2Fa%20b",
    );
    expect(resolvePath("frontDoor.articleList", "legacy")).toBe("/front-door/api/articles");
    expect(resolvePath("frontDoor.memoryList", "canonical")).toBe("/api/plugins/front-door/memory");
    expect(resolvePath("frontDoor.inboxUpload", "legacy")).toBe("/front-door/api/inbox");

    expect(resolvePath("trading.dashboard", "legacy")).toBe("/trading/api/dashboard");
    expect(resolvePath("trading.dashboard", "canonical")).toBe("/api/plugins/trading/dashboard");
    expect(resolvePath("trading.researchPackets", "legacy")).toBe("/trading/api/research-packets");
    expect(resolvePath("trading.researchPackets", "canonical")).toBe("/api/plugins/trading/research-packets");
    expect(resolvePath("trading.sourceRegistry", "legacy")).toBe("/trading/api/source-registry");
    expect(resolvePath("trading.sourceRegistry", "canonical")).toBe("/api/plugins/trading/source-registry");
  });

  it("keeps mobile portal/workspace contracts in the shared package", () => {
    expect(PORTAL_DASHBOARD_IDS).toEqual(["martina", "scout", "angela", "machine"]);
    expect(portalDashboardPath("martina")).toBe("/martina/api/dashboard");
    expect(portalDashboardPath("martina", "canonical")).toBe(
      "/api/plugins/portal/martina/dashboard",
    );
    for (const portal of PORTAL_DASHBOARD_IDS) {
      expect(portalDashboardPath(portal, "canonical")).toBe(
        `/api/plugins/portal/${portal}/dashboard`,
      );
    }
    expect(portalDashboardPath("front-door")).toBeNull();

    expect(getMobileGatewayEndpointPath("preflightCapabilities", "canonical")).toBe(
      "/v1/capabilities",
    );
    expect(getMobileGatewayEndpointPath("operatorTaskDispatch", "legacy")).toBe(
      "/cavi-control/api/operator/tasks",
    );
    expect(getMobileGatewayEndpointPath("operatorTaskDispatch", "canonical")).toBe(
      "/api/plugins/kanban/tasks",
    );
    expect(resolveOperatorTaskDispatchPath("kanban-native")).toBe("/api/plugins/kanban/tasks");
    expect(getMobileGatewayEndpointPath("teamWorkspace", "canonical")).toBe(
      "/api/teams/research/workspace/research/complete",
    );
    expect(getMobileGatewayEndpointPath("teamAgentWorkspace", "canonical")).toBe(
      "/api/teams/research/agents/scout/workspace/media/images",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaAudio", "canonical")).toBe(
      "/v1/media/audio/generate",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaVideo", "canonical")).toBe(
      "/v1/media/video/generate",
    );
    expect(getMobileGatewayEndpointPath("gatewayMediaMusic", "canonical")).toBe(
      "/v1/media/music/generate",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiVaults", "canonical")).toBe(
      "/v1/wiki/vaults",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiRead", "canonical")).toBe(
      "/v1/wiki/vaults/default/read?path=index.qmd",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiIngest", "canonical")).toBe(
      "/v1/wiki/vaults/default/ingest",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiCompile", "canonical")).toBe(
      "/v1/wiki/vaults/default/compile",
    );
    expect(getMobileGatewayEndpointPath("gatewayWikiPromote", "canonical")).toBe(
      "/v1/wiki/vaults/default/promote",
    );
    expect(MOBILE_GATEWAY_ENDPOINT_CONTRACTS.machineComedyRun.hermesPath).toBe("/v1/runs");
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
    expect(() => resolvePath("frontDoor.idea", "legacy")).toThrow(
      'SURFACE_CONTRACTS: missing path param "id"',
    );
    expect(() => resolvePath("portal.dashboard", "canonical", { portal: "" })).toThrow(
      'SURFACE_CONTRACTS: missing path param "portal"',
    );
    expect(() => resolvePath("cavi.operator.task", "legacy")).toThrow(
      'SURFACE_CONTRACTS: missing path param "taskId"',
    );
    expect(() => resolvePath("team.agent.config", "canonical", { teamId: "research" })).toThrow(
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
    ).rejects.toMatchObject({
      name: "HttpApiError",
      path: "/cancelled",
      status: 0,
    });
    callerController.abort("caller cancelled");
    await vi.advanceTimersByTimeAsync(0);

    await assertion;
  });

  it("uses inherited transport for library search", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const client = new LibraryApiClient({ baseUrl: "https://api.example", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.search({ q: "research", archived: false })).resolves.toEqual({ results: [] });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.example/library/api/search?q=research&archived=false");
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

  it("uses one gateway media interface across generic, Hermes, and OpenClaw providers", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url);
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
      { provider: "hermes" },
    );
    const openclaw = createGatewayMediaClient(
      { baseUrl: "https://gateway.example", fetchImpl: fetchImpl as unknown as typeof fetch },
      { provider: "openclaw" },
    );

    expect(generic.surface).toBe("gateway-media-api");
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
    await expect(openclaw.getMediaJob("video", "job/a b")).resolves.toMatchObject({
      id: "job/a b",
      kind: "video",
      status: "running",
    });
    const asset = await generic.getMediaAsset("asset/a b", { accept: "audio/mpeg" });

    expect(await asset.text()).toBe("asset-bytes");
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://gateway.example/v1/media/audio/providers",
      "https://gateway.example/v1/media/music/generate",
      "https://gateway.example/v1/media/video/jobs/job%2Fa%20b",
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
    expect(fetchImpl.mock.calls[3]?.[1]?.headers).toMatchObject({
      Accept: "audio/mpeg",
    });
    expect(() =>
      generic.generateMedia({ kind: "image" as never, input: "cover art" }),
    ).toThrow(/unsupported media kind/u);
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
      { provider: "hermes" },
    );
    const openclaw = createGatewayWikiClient(
      { baseUrl: "https://gateway.example", fetchImpl: fetchImpl as unknown as typeof fetch },
      { provider: "openclaw" },
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
    await expect(openclaw.compileWiki("research", {
      path: "index.qmd",
      target: "html",
    })).resolves.toMatchObject({
      jobId: "compile_1",
      status: "running",
    });
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
      "https://gateway.example/v1/wiki/vaults/research/compile",
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
    expect(fetchImpl.mock.calls[7]?.[1]?.headers).toMatchObject({
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
      { provider: "hermes" },
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
      { provider: "openclaw" },
    );
    const hermesWs = createGatewayWebSocketClient(
      "wss://gateway.example/api/ws",
      "test-token",
      { clientId: "client-1" },
      { provider: "hermes" },
    );
    const openclawWs = createGatewayWebSocketClient(
      "wss://gateway.example/ws",
      "test-token",
      { clientId: "client-1" },
      { provider: "openclaw" },
    );

    expect(hermes).toBeInstanceOf(HermesSseRunEventProvider);
    expect(openclaw).toBeInstanceOf(OpenClawSseRunEventProvider);
    expect(hermesWs).toBeInstanceOf(HermesWebSocketClient);
    expect(openclawWs).toBeInstanceOf(OpenClawWebSocketClient);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({
      "X-Hermes-Session-Key": "session-1",
    });
    expect(() =>
      createGatewaySseRunEventProvider(
        {
          httpBase: "https://gateway.example",
          authToken: "test-token",
          clientId: "client-1",
        },
        { provider: "hermes" },
      ),
    ).toThrow(/sessionKey/u);
  });
});

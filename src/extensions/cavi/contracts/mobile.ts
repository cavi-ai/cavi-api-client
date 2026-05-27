import { resolvePath } from "./resolve.js";

export type MobileGatewayEndpointContract = {
  surface: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  owner: string;
  note: string;
};

export type OperatorTaskDispatchMode = "operator-task" | "kanban-native";

export type MobileGatewayContractGap = {
  area: string;
  expectedContract: string;
  note: string;
  reason: "backend-not-configured" | "unknown";
};

export type GatewayTargets = {
  rawBase: string;
  httpBase: string;
  wsBase: string;
  authToken: string | null;
  wsPath: string;
};

export type HermesGatewayTargets = GatewayTargets;

const path = (key: string, params?: Record<string, string>): string =>
  resolvePath(key, params);

export const GATEWAY_WS_PATH = path("gateway.websocket");
export const GATEWAY_KANBAN_TASKS_PATH = path("kanban.tasks");
export const GATEWAY_KANBAN_BOARD_PATH = path("kanban.board");
export const HERMES_WS_PATH = GATEWAY_WS_PATH;
export const HERMES_KANBAN_TASKS_PATH = GATEWAY_KANBAN_TASKS_PATH;
export const HERMES_KANBAN_BOARD_PATH = GATEWAY_KANBAN_BOARD_PATH;

export const MOBILE_GATEWAY_ENDPOINT_CONTRACTS = {
  providerConfig: {
    surface: "provider-config",
    path: "http-base + /v1/*, /health*; ws-base + /api/ws",
    owner: "method-man",
    note: "Resolve explicit HTTP and WS targets from the saved gateway URL; preserve bearer auth.",
  },
  preflightHealth: {
    surface: "preflight-health",
    method: "GET",
    path: path("gateway.health"),
    owner: "method-man",
    note: "Primary reachability check for the selected gateway API server.",
  },
  preflightHealthDetailed: {
    surface: "preflight-health-detailed",
    method: "GET",
    path: path("gateway.healthDetailed"),
    owner: "method-man",
    note: "Detailed health check; failures should be reported without hiding the basic health result.",
  },
  preflightCapabilities: {
    surface: "preflight-capabilities",
    method: "GET",
    path: path("gateway.capabilities"),
    owner: "method-man",
    note: "Authenticated API-server capability proof for saved bearer tokens.",
  },
  websocketSession: {
    surface: "websocket-session",
    path: GATEWAY_WS_PATH,
    owner: "method-man",
    note: "Dashboard/TUI JSON-RPC for chat, sessions, logs, and health/status.",
  },
  gatewayMediaProviders: {
    surface: "gateway-media-providers",
    method: "GET",
    path: path("gateway.mediaProviders"),
    owner: "gateway/media contract",
    note: "Shared media provider inventory for audio, image, video, and music generation across gateways.",
  },
  gatewayMediaAudio: {
    surface: "gateway-media-audio",
    method: "POST",
    path: path("gateway.mediaAudioGenerate"),
    owner: "gateway/media contract",
    note: "Core audio generation route exposed through the provider-neutral media client.",
  },
  gatewayMediaImage: {
    surface: "gateway-media-image",
    method: "POST",
    path: path("gateway.mediaImageGenerate"),
    owner: "gateway/media contract",
    note: "Core image generation route exposed through the provider-neutral media client.",
  },
  gatewayMediaVideo: {
    surface: "gateway-media-video",
    method: "POST",
    path: path("gateway.mediaVideoGenerate"),
    owner: "gateway/media contract",
    note: "Core video generation route exposed through the provider-neutral media client.",
  },
  gatewayMediaMusic: {
    surface: "gateway-media-music",
    method: "POST",
    path: path("gateway.mediaMusicGenerate"),
    owner: "gateway/media contract",
    note: "Core music generation route exposed through the provider-neutral media client.",
  },
  gatewayMediaJob: {
    surface: "gateway-media-job",
    method: "GET",
    path: path("gateway.mediaJob", {
      kind: "video",
      jobId: "job",
    }),
    owner: "gateway/media contract",
    note: "Core media job status route used by audio, image, video, and music generation.",
  },
  gatewayMediaAssets: {
    surface: "gateway-media-assets",
    method: "GET",
    path: path("gateway.mediaAssets", { kind: "image" }),
    owner: "gateway/media contract",
    note: "Core media asset inventory route.",
  },
  gatewayMediaAsset: {
    surface: "gateway-media-asset",
    method: "GET",
    path: path("gateway.mediaAsset", { assetId: "asset" }),
    owner: "gateway/media contract",
    note: "Core media asset bytes and metadata route.",
  },
  gatewayWikiVaults: {
    surface: "gateway-wiki-vaults",
    method: "GET",
    path: path("gateway.wikiVaults"),
    owner: "gateway/wiki contract",
    note: "Core wiki vault inventory for external Obsidian/QMD plugin vaults.",
  },
  gatewayWikiTree: {
    surface: "gateway-wiki-tree",
    method: "GET",
    path: path("gateway.wikiTree", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core wiki tree route.",
  },
  gatewayWikiRead: {
    surface: "gateway-wiki-read",
    method: "GET",
    path: path("gateway.wikiRead", {
      vaultId: "default",
      path: "index.qmd",
    }),
    owner: "gateway/wiki contract",
    note: "Core wiki read route for QMD/Markdown pages.",
  },
  gatewayWikiIngest: {
    surface: "gateway-wiki-ingest",
    method: "POST",
    path: path("gateway.wikiIngest", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core wiki ingest route used by external wiki plugins.",
  },
  gatewayWikiCompile: {
    surface: "gateway-wiki-compile",
    method: "POST",
    path: path("gateway.wikiCompile", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core QMD compile route for wiki pages and collections.",
  },
  gatewayWikiPromote: {
    surface: "gateway-wiki-promote",
    method: "POST",
    path: path("gateway.wikiPromote", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core wiki promotion route for durable vault publishing.",
  },
  costHistory: {
    surface: "cost-history",
    method: "GET",
    path: path("cavi.costHistory"),
    owner: "gateway/cavi owner",
    note: "CAVI cost history endpoint.",
  },
  operatorStatus: {
    surface: "operator-status",
    method: "GET",
    path: path("cavi.operator.status"),
    owner: "gateway/cavi owner",
    note: "Operator-status endpoint used as an HTTP preflight fallback.",
  },
  operatorSnapshot: {
    surface: "operator-snapshot",
    method: "GET",
    path: path("cavi.operator.snapshot"),
    owner: "gateway/cavi owner",
    note: "CAVI Control operator aggregate snapshot for mobile and portal fallbacks.",
  },
  operatorTaskDispatch: {
    surface: "operator-task-dispatch",
    method: "POST",
    path: path("cavi.operator.tasks"),
    owner: "ODB + gateway owner",
    note: "OperatorTaskCreateRequest is accepted by the unified CAVI Control operator task endpoint.",
  },
  kanbanTasks: {
    surface: "kanban-tasks",
    method: "POST",
    path: GATEWAY_KANBAN_TASKS_PATH,
    owner: "gateway/kanban owner",
    note: "Kanban-native task creation remains a separate gateway surface from the CAVI Control operator task endpoint.",
  },
  kanbanBoard: {
    surface: "kanban-board",
    method: "GET",
    path: GATEWAY_KANBAN_BOARD_PATH,
    owner: "gateway/kanban owner",
    note: "Unified Kanban board through bearer-authenticated /api/plugins/kanban/board for Project Board and Operator visibility.",
  },
  teamWorkspace: {
    surface: "team-workspace",
    method: "GET",
    path: path("team.workspace", {
      teamId: "research",
      workspacePath: "research/complete",
    }),
    owner: "gateway/team contract",
    note: "Agnostic team-owned folder route; resolve the concrete path through the team manifest whitelist.",
  },
  teamAgentWorkspace: {
    surface: "team-agent-workspace",
    method: "GET",
    path: path("team.agent.workspace", {
      teamId: "research",
      agentId: "scout",
      workspacePath: "media/images",
    }),
    owner: "gateway/team contract",
    note: "Agnostic agent-owned media/research folder route; resolve concrete paths through the team manifest whitelist.",
  },
  frontDoorDashboard: {
    surface: "front-door-dashboard",
    method: "GET",
    path: path("frontDoor.dashboard"),
    owner: "front-door gateway owner",
    note: "Front Door dashboard endpoint.",
  },
  frontDoorIdeas: {
    surface: "front-door-ideas",
    method: "POST",
    path: path("frontDoor.ideas"),
    owner: "front-door gateway owner",
    note: "Front Door idea mutation endpoint.",
  },
  frontDoorMemory: {
    surface: "front-door-memory",
    method: "POST",
    path: path("frontDoor.memory"),
    owner: "front-door gateway owner",
    note: "Front Door memory endpoint.",
  },
  frontDoorArticles: {
    surface: "front-door-articles",
    method: "POST",
    path: path("frontDoor.articles"),
    owner: "front-door gateway owner",
    note: "Front Door article endpoint.",
  },
  frontDoorInbox: {
    surface: "front-door-inbox",
    method: "POST",
    path: path("frontDoor.inbox"),
    owner: "front-door gateway owner",
    note: "Front Door inbox upload endpoint.",
  },
  tradingDashboard: {
    surface: "trading-dashboard",
    method: "GET",
    path: path("trading.dashboard"),
    owner: "trading gateway owner",
    note: "Trading portal snapshot: research packet cards, source folders, market-data recommendations, and source registry status.",
  },
  tradingResearchPackets: {
    surface: "trading-research-packets",
    method: "GET",
    path: path("trading.researchPackets"),
    owner: "trading gateway owner",
    note: "Thin packet-list endpoint for saved research packet folders. Must preserve bearer auth and return structured packet metadata, not raw secret-bearing filesystem state.",
  },
  fleetLibrary: {
    surface: "fleet-library",
    method: "GET",
    path: path("library.fleetStatus"),
    owner: "library gateway owner",
    note: "Base fleet snapshot; mobile enriches it with library status, inbox, promotable, and review-request paths when available.",
  },
  libraryPipelineStatus: {
    surface: "library-pipeline-status",
    method: "GET",
    path: path("library.status"),
    owner: "library gateway owner",
    note: "Library ingest pipeline counters used by the mobile forge and fleet summaries.",
  },
  libraryPipelineInbox: {
    surface: "library-pipeline-inbox",
    method: "GET",
    path: path("library.inbox"),
    owner: "library gateway owner",
    note: "Optional inbox item detail for assigning arrival pressure to library lanes.",
  },
  libraryPromotable: {
    surface: "library-promotable",
    method: "GET",
    path: path("library.promotable"),
    owner: "library gateway owner",
    note: "Promotable note rows used to hydrate the library board, promotions, and graph surfaces.",
  },
  libraryReviewRequests: {
    surface: "library-review-requests",
    method: "GET",
    path: path("library.reviewRequests"),
    owner: "library gateway owner",
    note: "Review-request state joined onto promotable notes before mobile renders library operation rows.",
  },
  machineDashboard: {
    surface: "machine-dashboard",
    method: "GET",
    path: path("machine.dashboard"),
    owner: "machine gateway owner",
    note: "Machine portal aggregate snapshot: voice agents, media rows, sample counters, and comedy dashboard context. Missing route uses dashboard fallback payload instead of hard-failing the mobile surface.",
  },
  machineComedyRun: {
    surface: "machine-comedy-run",
    method: "POST",
    path: path("machine.comedyRun"),
    owner: "machine/comedy agent owner",
    note: "Comedy actions run through gateway REST/SSE /v1/runs using the machine comedy run action.",
  },
  machineTtsProviders: {
    surface: "machine-tts-providers",
    method: "GET",
    path: path("machine.ttsProviders"),
    owner: "machine gateway owner",
    note: "Voice Lab provider inventory for audio comedy features; 404 is a compatibility gap, not a mobile crash.",
  },
  machineTts: {
    surface: "machine-tts",
    method: "POST",
    path: path("machine.tts"),
    owner: "machine gateway owner",
    note: "Text-to-speech render path for machine audio output.",
  },
  machineMedia: {
    surface: "machine-media",
    method: "GET",
    path: path("machine.media", { filename: "sample.mp3" }),
    owner: "machine gateway owner",
    note: "Authenticated machine media fetch/thumbnail endpoint used by comedy, meme, caption, and voice surfaces.",
  },
  machineMemeJobs: {
    surface: "machine-meme-jobs",
    method: "GET",
    path: path("machine.memeJobs"),
    owner: "machine gateway owner",
    note: "Meme job listing/mutation surface; endpoint may be absent on minimal gateways and should degrade gracefully.",
  },
  machineChrisComedyMemory: {
    surface: "machine-comedy-memory",
    method: "GET",
    path: path("portalMemory.snapshot", {
      teamSlug: "machine",
      memberId: "comedy",
      memoryKey: "comedy-room",
    }),
    owner: "machine gateway owner",
    note: "Portable portal-memory envelope for comedy joke-room themes/callbacks; local device persistence remains the offline fallback.",
  },
  machineInbox: {
    surface: "machine-inbox",
    method: "POST",
    path: path("machine.inbox"),
    owner: "machine gateway owner",
    note: "Machine-owned media/action upload route.",
  },
  vaultTree: {
    surface: "vault-tree",
    method: "GET",
    path: path("vault.tree"),
    owner: "vault/gateway owner",
    note: "Obsidian vault tree route.",
  },
  vaultRead: {
    surface: "vault-read",
    method: "GET",
    path: path("vault.read"),
    owner: "vault/gateway owner",
    note: "Obsidian file read route.",
  },
  wuTangGithub: {
    surface: "wu-tang-github-proxy",
    path: path("wuTang.githubProxyWildcard"),
    owner: "wu-tang gateway owner",
    note: "Keep GitHub PAT custody server-side; never move PAT or GitHub auth to device.",
  },
} as const satisfies Record<string, MobileGatewayEndpointContract>;

export type MobileGatewaySurfaceKey = keyof typeof MOBILE_GATEWAY_ENDPOINT_CONTRACTS;

export function getMobileGatewayEndpointContract(
  key: MobileGatewaySurfaceKey,
): MobileGatewayEndpointContract {
  return MOBILE_GATEWAY_ENDPOINT_CONTRACTS[key];
}

export function getMobileGatewayEndpointPath(key: MobileGatewaySurfaceKey): string {
  const contract = getMobileGatewayEndpointContract(key);
  if (!contract.path) {
    throw new Error(`Mobile gateway contract ${contract.surface} has no endpoint path`);
  }
  return contract.path;
}

export function createContractGap(
  key: MobileGatewaySurfaceKey,
  note?: string,
): MobileGatewayContractGap {
  const contract = getMobileGatewayEndpointContract(key);
  return {
    area: contract.surface,
    expectedContract: contract.path ?? contract.surface,
    note: note ?? contract.note,
    reason: "unknown",
  };
}

export function resolveOperatorTaskDispatchContract(
  mode: OperatorTaskDispatchMode,
): MobileGatewayEndpointContract {
  if (mode === "kanban-native") return getMobileGatewayEndpointContract("kanbanTasks");
  return getMobileGatewayEndpointContract("operatorTaskDispatch");
}

export function resolveOperatorTaskDispatchPath(
  mode: OperatorTaskDispatchMode = "operator-task",
): string {
  const contract = resolveOperatorTaskDispatchContract(mode);
  if (!contract.path) {
    throw new Error(`Operator task dispatch mode ${mode} has no endpoint path`);
  }
  return contract.path;
}

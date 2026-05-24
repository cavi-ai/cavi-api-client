import { resolvePath } from "./resolve.js";
import type { GatewayMode } from "./surfaces.js";

export type MobileGatewaySurfaceClass =
  | "gateway-native"
  | "compatibility-shim"
  | "blocked";

export type MobileGatewayEndpointContract = {
  surface: string;
  classification: MobileGatewaySurfaceClass;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  currentPath?: string;
  hermesPath?: string;
  owner: string;
  note: string;
};

export type OperatorTaskDispatchMode =
  | "operator-task-shim"
  | "kanban-native"
  | "blocked";

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

const legacyPath = (key: string, params?: Record<string, string>): string =>
  resolvePath(key, "legacy", params);
const canonicalPath = (key: string, params?: Record<string, string>): string =>
  resolvePath(key, "canonical", params);

export const GATEWAY_WS_PATH = canonicalPath("gateway.websocket");
export const GATEWAY_KANBAN_TASKS_PATH = canonicalPath("kanban.tasks");
export const GATEWAY_KANBAN_BOARD_PATH = canonicalPath("kanban.board");
export const HERMES_WS_PATH = GATEWAY_WS_PATH;
export const HERMES_KANBAN_TASKS_PATH = GATEWAY_KANBAN_TASKS_PATH;
export const HERMES_KANBAN_BOARD_PATH = GATEWAY_KANBAN_BOARD_PATH;

export const MOBILE_GATEWAY_ENDPOINT_CONTRACTS = {
  providerConfig: {
    surface: "provider-config",
    classification: "gateway-native",
    hermesPath: "http-base + /v1/*, /health*; ws-base + /api/ws",
    owner: "method-man",
    note: "Resolve explicit HTTP and WS targets from the saved gateway URL; preserve bearer auth.",
  },
  preflightHealth: {
    surface: "preflight-health",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("gateway.health"),
    owner: "method-man",
    note: "Primary reachability check for the selected gateway API server.",
  },
  preflightHealthDetailed: {
    surface: "preflight-health-detailed",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("gateway.healthDetailed"),
    owner: "method-man",
    note: "Detailed health check; failures should be reported without hiding the basic health result.",
  },
  preflightCapabilities: {
    surface: "preflight-capabilities",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("gateway.capabilities"),
    owner: "method-man",
    note: "Authenticated API-server capability proof for saved bearer tokens.",
  },
  websocketSession: {
    surface: "websocket-session",
    classification: "gateway-native",
    hermesPath: GATEWAY_WS_PATH,
    owner: "method-man",
    note: "Dashboard/TUI JSON-RPC for chat, sessions, logs, and health.snapshot.",
  },
  gatewayMediaProviders: {
    surface: "gateway-media-providers",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("gateway.mediaProviders"),
    owner: "gateway/media contract",
    note: "Shared media provider inventory for audio, image, video, and music generation across Hermes and OpenClaw.",
  },
  gatewayMediaAudio: {
    surface: "gateway-media-audio",
    classification: "gateway-native",
    method: "POST",
    hermesPath: canonicalPath("gateway.mediaAudioGenerate"),
    owner: "gateway/media contract",
    note: "Core audio generation route; Machine TTS remains only a compatibility shim.",
  },
  gatewayMediaImage: {
    surface: "gateway-media-image",
    classification: "gateway-native",
    method: "POST",
    hermesPath: canonicalPath("gateway.mediaImageGenerate"),
    owner: "gateway/media contract",
    note: "Core image generation route exposed through the provider-neutral media client.",
  },
  gatewayMediaVideo: {
    surface: "gateway-media-video",
    classification: "gateway-native",
    method: "POST",
    hermesPath: canonicalPath("gateway.mediaVideoGenerate"),
    owner: "gateway/media contract",
    note: "Core video generation route exposed through the provider-neutral media client.",
  },
  gatewayMediaMusic: {
    surface: "gateway-media-music",
    classification: "gateway-native",
    method: "POST",
    hermesPath: canonicalPath("gateway.mediaMusicGenerate"),
    owner: "gateway/media contract",
    note: "Core music generation route exposed through the provider-neutral media client.",
  },
  gatewayWikiVaults: {
    surface: "gateway-wiki-vaults",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("gateway.wikiVaults"),
    owner: "gateway/wiki contract",
    note: "Core wiki vault inventory for external Obsidian/QMD plugin vaults.",
  },
  gatewayWikiTree: {
    surface: "gateway-wiki-tree",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("gateway.wikiTree", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core wiki tree route; legacy vault tree remains a compatibility shim.",
  },
  gatewayWikiRead: {
    surface: "gateway-wiki-read",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("gateway.wikiRead", {
      vaultId: "default",
      path: "index.qmd",
    }),
    owner: "gateway/wiki contract",
    note: "Core wiki read route for QMD/Markdown pages.",
  },
  gatewayWikiIngest: {
    surface: "gateway-wiki-ingest",
    classification: "gateway-native",
    method: "POST",
    hermesPath: canonicalPath("gateway.wikiIngest", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core wiki ingest route used by Hermes and OpenClaw external wiki plugins.",
  },
  gatewayWikiCompile: {
    surface: "gateway-wiki-compile",
    classification: "gateway-native",
    method: "POST",
    hermesPath: canonicalPath("gateway.wikiCompile", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core QMD compile route for wiki pages and collections.",
  },
  gatewayWikiPromote: {
    surface: "gateway-wiki-promote",
    classification: "gateway-native",
    method: "POST",
    hermesPath: canonicalPath("gateway.wikiPromote", { vaultId: "default" }),
    owner: "gateway/wiki contract",
    note: "Core wiki promotion route for durable vault publishing.",
  },
  costHistory: {
    surface: "cost-history",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("cavi.costHistory"),
    owner: "gateway/cavi owner",
    note: "No native gateway cost history endpoint identified; keep gateway-side CAVI shim.",
  },
  operatorStatus: {
    surface: "operator-status",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("cavi.operator.status"),
    owner: "gateway/cavi owner",
    note: "Legacy operator-status shim used only as an HTTP preflight fallback.",
  },
  operatorSnapshot: {
    surface: "operator-snapshot",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("cavi.operator.snapshot"),
    hermesPath: canonicalPath("cavi.operator.snapshot"),
    owner: "gateway/cavi owner",
    note: "Operator aggregate shim mirrors Hermes Kanban-backed task visibility for mobile while preserving the existing CAVI path.",
  },
  operatorTaskDispatch: {
    surface: "operator-task-dispatch",
    classification: "compatibility-shim",
    method: "POST",
    currentPath: legacyPath("cavi.operator.tasks"),
    hermesPath: canonicalPath("cavi.operator.tasks"),
    owner: "ODB + gateway owner",
    note: "Existing OperatorTaskCreateRequest envelope is accepted by the operator shim and mapped to Kanban task creation server-side.",
  },
  kanbanTasks: {
    surface: "kanban-tasks",
    classification: "gateway-native",
    method: "POST",
    hermesPath: GATEWAY_KANBAN_TASKS_PATH,
    owner: "gateway/kanban owner",
    note: "Hermes API Server exposes Kanban task creation through bearer-authenticated /api/plugins/kanban/tasks for mobile and operator surfaces.",
  },
  kanbanBoard: {
    surface: "kanban-board",
    classification: "gateway-native",
    method: "GET",
    hermesPath: GATEWAY_KANBAN_BOARD_PATH,
    owner: "gateway/kanban owner",
    note: "Hermes API Server exposes the unified Kanban board through bearer-authenticated /api/plugins/kanban/board for Project Board and Operator visibility.",
  },
  teamWorkspace: {
    surface: "team-workspace",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("team.workspace", {
      teamId: "research",
      workspacePath: "research/complete",
    }),
    owner: "gateway/team contract",
    note: "Preferred agnostic replacement for team-owned folder shims; resolve the concrete path through the team manifest whitelist.",
  },
  teamAgentWorkspace: {
    surface: "team-agent-workspace",
    classification: "gateway-native",
    method: "GET",
    hermesPath: canonicalPath("team.agent.workspace", {
      teamId: "research",
      agentId: "scout",
      workspacePath: "media/images",
    }),
    owner: "gateway/team contract",
    note: "Preferred agnostic replacement for agent-owned media/research folder shims; resolve concrete paths through the team manifest whitelist.",
  },
  frontDoorDashboard: {
    surface: "front-door-dashboard",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("frontDoor.dashboard"),
    owner: "front-door gateway owner",
    note: "No native gateway dashboard endpoint identified; keep Front Door shim.",
  },
  frontDoorIdeas: {
    surface: "front-door-ideas",
    classification: "compatibility-shim",
    method: "POST",
    currentPath: legacyPath("frontDoor.ideas"),
    owner: "front-door gateway owner",
    note: "No native gateway mutation endpoint identified; keep Front Door shim.",
  },
  frontDoorMemory: {
    surface: "front-door-memory",
    classification: "compatibility-shim",
    method: "POST",
    currentPath: legacyPath("frontDoor.memory"),
    owner: "front-door gateway owner",
    note: "No native gateway memory endpoint identified; keep Front Door shim.",
  },
  frontDoorArticles: {
    surface: "front-door-articles",
    classification: "compatibility-shim",
    method: "POST",
    currentPath: legacyPath("frontDoor.articles"),
    owner: "front-door gateway owner",
    note: "No native gateway article endpoint identified; keep Front Door shim.",
  },
  frontDoorInbox: {
    surface: "front-door-inbox",
    classification: "compatibility-shim",
    method: "POST",
    currentPath: legacyPath("frontDoor.inbox"),
    owner: "front-door gateway owner",
    note: "No native gateway inbox upload endpoint identified; keep Front Door shim.",
  },
  tradingDashboard: {
    surface: "trading-dashboard",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("trading.dashboard"),
    owner: "trading gateway owner",
    note: "Wes trading portal snapshot: research packet cards, source folders, market-data recommendations, and source registry status. Mobile falls back to the checked packet-derived baseline until gateway exposes the workspace folder API.",
  },
  tradingResearchPackets: {
    surface: "trading-research-packets",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("trading.researchPackets"),
    owner: "trading gateway owner",
    note: "Thin packet-list endpoint for Wes's saved research packet folders under the trading workspace. Must preserve bearer auth and return structured packet metadata, not raw secret-bearing filesystem state.",
  },
  fleetLibrary: {
    surface: "fleet-library",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("library.fleetStatus"),
    owner: "library gateway owner",
    note: "Base Sigmund fleet snapshot; mobile enriches it with library status, inbox, promotable, and review-request paths when available.",
  },
  libraryPipelineStatus: {
    surface: "library-pipeline-status",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("library.status"),
    owner: "library gateway owner",
    note: "Scholar's Lounge ingest pipeline counters used by the mobile forge and fleet summaries.",
  },
  libraryPipelineInbox: {
    surface: "library-pipeline-inbox",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("library.inbox"),
    owner: "library gateway owner",
    note: "Optional inbox item detail for assigning arrival pressure to library lanes.",
  },
  libraryPromotable: {
    surface: "library-promotable",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("library.promotable"),
    owner: "library gateway owner",
    note: "Promotable note rows used to hydrate Sigmund's mobile board, promotions, and graph surfaces.",
  },
  libraryReviewRequests: {
    surface: "library-review-requests",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("library.reviewRequests"),
    owner: "library gateway owner",
    note: "Review-request state joined onto promotable notes before mobile renders library operation rows.",
  },
  machineDashboard: {
    surface: "machine-dashboard",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("machine.dashboard"),
    owner: "machine gateway owner",
    note: "Machine portal aggregate snapshot: voice agents, media rows, sample counters, and Chris/comedy dashboard context. Missing legacy route must use dashboard fallback payload instead of hard-failing the mobile surface.",
  },
  machineComedyRun: {
    surface: "machine-comedy-run",
    classification: "gateway-native",
    method: "POST",
    currentPath: legacyPath("machine.comedyRun"),
    hermesPath: canonicalPath("machine.comedyRun"),
    owner: "machine/chris agent owner",
    note: "Chris joke/comedy actions prefer Hermes REST/SSE /v1/runs using action machine.chris.comedy.run when the legacy /machine/api/comedy/run shim is missing.",
  },
  machineTtsProviders: {
    surface: "machine-tts-providers",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("machine.ttsProviders"),
    owner: "machine gateway owner",
    note: "Voice Lab provider inventory for Chris/audio comedy features; 404 is a compatibility gap, not a mobile crash.",
  },
  machineTts: {
    surface: "machine-tts",
    classification: "compatibility-shim",
    method: "POST",
    currentPath: legacyPath("machine.tts"),
    owner: "machine gateway owner",
    note: "Text-to-speech render path for Machine/Chris audio output; remains gateway-owned media generation shim.",
  },
  machineMedia: {
    surface: "machine-media",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("machine.media", { filename: "chris-joke.mp3" }),
    owner: "machine gateway owner",
    note: "Authenticated Machine media fetch/thumbnail endpoint used by comedy, meme, caption, and voice surfaces.",
  },
  machineMemeJobs: {
    surface: "machine-meme-jobs",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("machine.memeJobs"),
    owner: "machine gateway owner",
    note: "Meme job listing/mutation surface used by the Machine meme workshop; endpoint may be absent on Hermes-only gateways and should degrade gracefully.",
  },
  machineChrisComedyMemory: {
    surface: "machine-chris-comedy-memory",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("portalMemory.snapshot", {
      teamSlug: "machine",
      memberId: "chris",
      memoryKey: "comedy-room",
    }),
    owner: "machine gateway owner",
    note: "Portable portal-memory envelope for Chris joke-room themes/callbacks; local device persistence remains the offline fallback.",
  },
  machineInbox: {
    surface: "machine-inbox",
    classification: "compatibility-shim",
    method: "POST",
    currentPath: legacyPath("machine.inbox"),
    owner: "machine gateway owner",
    note: "Media/action routes remain machine-owned gateway shims.",
  },
  vaultTree: {
    surface: "vault-tree",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("vault.tree"),
    owner: "vault/gateway owner",
    note: "No native gateway Obsidian route identified in this slice.",
  },
  vaultRead: {
    surface: "vault-read",
    classification: "compatibility-shim",
    method: "GET",
    currentPath: legacyPath("vault.read"),
    owner: "vault/gateway owner",
    note: "No native gateway Obsidian route identified in this slice.",
  },
  wuTangGithub: {
    surface: "wu-tang-github-proxy",
    classification: "compatibility-shim",
    currentPath: legacyPath("wuTang.githubProxyWildcard"),
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

export function getMobileGatewayEndpointPath(
  key: MobileGatewaySurfaceKey,
  mode: GatewayMode = "legacy",
): string {
  const contract = getMobileGatewayEndpointContract(key);
  const path =
    mode === "canonical"
      ? contract.hermesPath ?? contract.currentPath
      : contract.currentPath ?? contract.hermesPath;
  if (!path) {
    throw new Error(`Mobile gateway contract ${contract.surface} has no endpoint path`);
  }
  return path;
}

export function createContractGap(
  key: MobileGatewaySurfaceKey,
  note?: string,
): MobileGatewayContractGap {
  const contract = getMobileGatewayEndpointContract(key);
  return {
    area: contract.surface,
    expectedContract:
      contract.hermesPath ?? contract.currentPath ?? contract.surface,
    note: note ?? contract.note,
    reason:
      contract.classification === "blocked"
        ? "backend-not-configured"
        : "unknown",
  };
}

export function resolveOperatorTaskDispatchContract(mode: OperatorTaskDispatchMode) {
  if (mode === "blocked") return getMobileGatewayEndpointContract("kanbanTasks");
  if (mode === "kanban-native") return getMobileGatewayEndpointContract("kanbanTasks");
  return getMobileGatewayEndpointContract("operatorTaskDispatch");
}

export function resolveOperatorTaskDispatchPath(
  mode: OperatorTaskDispatchMode = "operator-task-shim",
): string {
  const contract = resolveOperatorTaskDispatchContract(mode);
  const path = mode === "kanban-native" ? contract.hermesPath : contract.currentPath;
  if (!path) {
    throw new Error(`Operator task dispatch mode ${mode} has no endpoint path`);
  }
  return path;
}

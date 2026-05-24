import {
  GATEWAY_MEDIA_API_ENDPOINTS,
  GATEWAY_WIKI_API_ENDPOINTS,
} from "./paths.js";
import { resolveTeamRoutePath } from "./team-manifest.js";

export type GatewayMode = "legacy" | "canonical";

export type SurfaceContract = {
  key: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  canonicalPath: (params?: Record<string, string>) => string;
  legacyPath?: (params?: Record<string, string>) => string;
  classification: "gateway-native" | "compatibility-shim" | "blocked";
  degradation: "hard" | "gap" | "silent";
  owner: string;
  note: string;
};

const p = (params: Record<string, string> | undefined, k: string): string => {
  const v = params?.[k];
  if (!v) throw new Error(`SURFACE_CONTRACTS: missing path param "${k}"`);
  return encodeURIComponent(v);
};

const raw = (params: Record<string, string> | undefined, k: string): string => {
  const v = params?.[k];
  if (!v) throw new Error(`SURFACE_CONTRACTS: missing path param "${k}"`);
  return v;
};

export const SURFACE_CONTRACTS: Record<string, SurfaceContract> = {
  "vault.tree": {
    key: "vault.tree",
    method: "GET",
    legacyPath: () => "/api/obsidian/tree",
    canonicalPath: () => "/api/obsidian/tree",
    classification: "compatibility-shim",
    degradation: "gap",
    owner: "vault/gateway owner",
    note: "Obsidian vault tree; no native gateway route identified yet.",
  },
  "vault.read": {
    key: "vault.read",
    method: "GET",
    legacyPath: () => "/api/obsidian/read",
    canonicalPath: () => "/api/obsidian/read",
    classification: "compatibility-shim",
    degradation: "gap",
    owner: "vault/gateway owner",
    note: "Obsidian file read; query string appended by caller.",
  },
  "gateway.health": {
    key: "gateway.health",
    method: "GET",
    canonicalPath: () => "/health",
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/core contract",
    note: "Primary reachability check for the selected gateway API server.",
  },
  "gateway.healthDetailed": {
    key: "gateway.healthDetailed",
    method: "GET",
    canonicalPath: () => "/health/detailed",
    classification: "gateway-native",
    degradation: "gap",
    owner: "gateway/core contract",
    note: "Detailed gateway health check; absence is a compatibility gap when basic health/capabilities pass.",
  },
  "gateway.capabilities": {
    key: "gateway.capabilities",
    method: "GET",
    canonicalPath: () => "/v1/capabilities",
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/core contract",
    note: "Authenticated API-server capability proof for saved bearer tokens.",
  },
  "gateway.websocket": {
    key: "gateway.websocket",
    method: "GET",
    canonicalPath: () => "/api/ws",
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/core contract",
    note: "Dashboard/TUI JSON-RPC websocket path for chat, sessions, logs, and health snapshots.",
  },
  "gateway.mediaProviders": {
    key: "gateway.mediaProviders",
    method: "GET",
    canonicalPath: () => GATEWAY_MEDIA_API_ENDPOINTS.providers(),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/media contract",
    note: "Gateway-native media provider inventory shared by audio, image, video, and music generation.",
  },
  "gateway.mediaAudioGenerate": {
    key: "gateway.mediaAudioGenerate",
    method: "POST",
    canonicalPath: () => GATEWAY_MEDIA_API_ENDPOINTS.generate("audio"),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/media contract",
    note: "Gateway-native audio generation route.",
  },
  "gateway.mediaImageGenerate": {
    key: "gateway.mediaImageGenerate",
    method: "POST",
    canonicalPath: () => GATEWAY_MEDIA_API_ENDPOINTS.generate("image"),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/media contract",
    note: "Gateway-native image generation route.",
  },
  "gateway.mediaVideoGenerate": {
    key: "gateway.mediaVideoGenerate",
    method: "POST",
    canonicalPath: () => GATEWAY_MEDIA_API_ENDPOINTS.generate("video"),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/media contract",
    note: "Gateway-native video generation route.",
  },
  "gateway.mediaMusicGenerate": {
    key: "gateway.mediaMusicGenerate",
    method: "POST",
    canonicalPath: () => GATEWAY_MEDIA_API_ENDPOINTS.generate("music"),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/media contract",
    note: "Gateway-native music generation route.",
  },
  "gateway.wikiVaults": {
    key: "gateway.wikiVaults",
    method: "GET",
    canonicalPath: () => GATEWAY_WIKI_API_ENDPOINTS.vaults,
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/wiki contract",
    note: "Gateway-native wiki vault inventory for external Obsidian/QMD plugin vaults.",
  },
  "gateway.wikiTree": {
    key: "gateway.wikiTree",
    method: "GET",
    canonicalPath: (params) => GATEWAY_WIKI_API_ENDPOINTS.tree(raw(params, "vaultId")),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/wiki contract",
    note: "Gateway-native wiki tree route.",
  },
  "gateway.wikiRead": {
    key: "gateway.wikiRead",
    method: "GET",
    canonicalPath: (params) =>
      GATEWAY_WIKI_API_ENDPOINTS.read(raw(params, "vaultId"), raw(params, "path")),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/wiki contract",
    note: "Gateway-native wiki page read route.",
  },
  "gateway.wikiIngest": {
    key: "gateway.wikiIngest",
    method: "POST",
    canonicalPath: (params) =>
      GATEWAY_WIKI_API_ENDPOINTS.ingest(raw(params, "vaultId")),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/wiki contract",
    note: "Gateway-native wiki ingest route.",
  },
  "gateway.wikiCompile": {
    key: "gateway.wikiCompile",
    method: "POST",
    canonicalPath: (params) =>
      GATEWAY_WIKI_API_ENDPOINTS.compile(raw(params, "vaultId")),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/wiki contract",
    note: "Gateway-native QMD compile route.",
  },
  "gateway.wikiPromote": {
    key: "gateway.wikiPromote",
    method: "POST",
    canonicalPath: (params) =>
      GATEWAY_WIKI_API_ENDPOINTS.promote(raw(params, "vaultId")),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/wiki contract",
    note: "Gateway-native wiki promotion route.",
  },
  "hermes.runs": {
    key: "hermes.runs",
    method: "POST",
    canonicalPath: () => "/v1/runs",
    classification: "gateway-native",
    degradation: "hard",
    owner: "providers/hermes",
    note: "Hermes REST/SSE run creation endpoint.",
  },
  "kanban.tasks": {
    key: "kanban.tasks",
    method: "POST",
    canonicalPath: () => "/api/plugins/kanban/tasks",
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/kanban owner",
    note: "Kanban task creation endpoint for workspace and operator surfaces.",
  },
  "kanban.board": {
    key: "kanban.board",
    method: "GET",
    canonicalPath: () => "/api/plugins/kanban/board",
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/kanban owner",
    note: "Unified Kanban board endpoint.",
  },
  "team.kanban": {
    key: "team.kanban",
    method: "GET",
    canonicalPath: (params) =>
      resolveTeamRoutePath("kanban", { teamId: raw(params, "teamId") }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic team Kanban route derived from the team manifest identity.",
  },
  "team.runs": {
    key: "team.runs",
    method: "GET",
    canonicalPath: (params) =>
      resolveTeamRoutePath("runs", { teamId: raw(params, "teamId") }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic team runs route derived from the team manifest identity.",
  },
  "team.config": {
    key: "team.config",
    method: "GET",
    canonicalPath: (params) =>
      resolveTeamRoutePath("config", { teamId: raw(params, "teamId") }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic team config route derived from the team manifest identity.",
  },
  "team.workspace": {
    key: "team.workspace",
    method: "GET",
    canonicalPath: (params) =>
      resolveTeamRoutePath("workspace", {
        teamId: raw(params, "teamId"),
        workspacePath: raw(params, "workspacePath"),
      }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic whitelisted team workspace route.",
  },
  "team.action": {
    key: "team.action",
    method: "POST",
    canonicalPath: (params) =>
      resolveTeamRoutePath("action", {
        teamId: raw(params, "teamId"),
        actionId: raw(params, "actionId"),
      }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic team action route derived from a manifest action contract.",
  },
  "team.agent.config": {
    key: "team.agent.config",
    method: "GET",
    canonicalPath: (params) =>
      resolveTeamRoutePath("agent.config", {
        teamId: raw(params, "teamId"),
        agentId: raw(params, "agentId"),
      }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic team member config route.",
  },
  "team.agent.action": {
    key: "team.agent.action",
    method: "POST",
    canonicalPath: (params) =>
      resolveTeamRoutePath("agent.action", {
        teamId: raw(params, "teamId"),
        agentId: raw(params, "agentId"),
        actionId: raw(params, "actionId"),
      }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic team member action route.",
  },
  "team.agent.workspace": {
    key: "team.agent.workspace",
    method: "GET",
    canonicalPath: (params) =>
      resolveTeamRoutePath("agent.workspace", {
        teamId: raw(params, "teamId"),
        agentId: raw(params, "agentId"),
        workspacePath: raw(params, "workspacePath"),
      }),
    classification: "gateway-native",
    degradation: "hard",
    owner: "gateway/team contract",
    note: "Agnostic whitelisted team-member workspace route.",
  },
};

import type {
  CapabilityKey,
  CapabilitySupport,
} from "../../core/runtime/capability-taxonomy.js";
import type { ResolvedProviderCapabilities } from "../../contracts/capability-source.js";
import {
  normalizeTeamManifest,
  TEAM_MANIFEST_VERSION,
  type ManifestMember,
  type TeamActionContract,
  type TeamActionHttpMethod,
} from "../../contracts/team-manifest.js";

/**
 * Transform a Hermes API-server capabilities response (design decision M1)
 * into the unified `ResolvedProviderCapabilities` shape:
 *
 * - `supports` is inferred from the advertised features and endpoints —
 *   conservatively: only positive detections are set, everything else is left
 *   unmentioned so the static fallback fills it during the merge.
 * - `manifest` members and action routes are built from the endpoint paths the
 *   provider publishes. Agent/portal/workspace names are extracted from the
 *   response at runtime — the package hardcodes route SHAPES only, never an
 *   agent name or endpoint literal.
 */

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const HTTP_METHODS: readonly TeamActionHttpMethod[] = [
  "DELETE",
  "GET",
  "PATCH",
  "POST",
  "PUT",
];

function parseMethods(value: unknown): TeamActionHttpMethod[] {
  const raw = asString(value);
  if (!raw) return [];
  const methods: TeamActionHttpMethod[] = [];
  for (const token of raw.split("|")) {
    const candidate = token.trim().toUpperCase();
    if ((HTTP_METHODS as readonly string[]).includes(candidate)) {
      methods.push(candidate as TeamActionHttpMethod);
    }
  }
  return methods;
}

function pathSegments(path: string): string[] {
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

type EndpointEntry = {
  key: string;
  methods: TeamActionHttpMethod[];
  path: string;
};

function collectEndpoints(value: unknown): EndpointEntry[] {
  if (!isRecord(value)) return [];
  const entries: EndpointEntry[] = [];
  for (const [key, spec] of Object.entries(value)) {
    if (!isRecord(spec)) continue;
    const path = asString(spec.path);
    if (!path || !path.startsWith("/")) continue;
    entries.push({ key, methods: parseMethods(spec.method), path });
  }
  return entries;
}

/** Structural namespace segments of the control plugin's own route contract. */
const CONTROL_STRUCTURAL_SEGMENTS = new Set(["operator", "kanban", "cost", "scoring"]);

type Classified = {
  member: { id: string; kind: "portal" | "workspace" } | null;
  tags: CapabilityKey[];
  skip: boolean;
};

function classify(segments: readonly string[]): Classified {
  const tags = new Set<CapabilityKey>();
  const none: Classified = { member: null, tags: [], skip: false };

  // Core runtime aliases advertised by plugins duplicate the RuntimeClient
  // surface; they never become manifest actions.
  if (segments[0] === "v1") return { member: null, tags: [], skip: true };
  if (segments[0] !== "api") return none;

  if (segments[1] === "obsidian") {
    return { member: null, tags: ["wiki"], skip: false };
  }
  if (segments[1] === "sessions") {
    tags.add("sessions");
    if (segments[2] === "usage") tags.add("usage");
    return { member: null, tags: [...tags], skip: false };
  }
  if (segments[1] !== "plugins") return none;

  // Portal members: the portal id is data from the response, never a constant.
  if (segments[2] === "portal" && segments[3]) {
    const rest = segments.slice(4);
    if (rest.includes("media") || rest.includes("tts")) tags.add("media");
    if (rest[0] === "config") tags.add("agentConfig");
    return { member: { id: segments[3], kind: "portal" }, tags: [...tags], skip: false };
  }

  if (segments[2] === "cavi-control" && segments[3]) {
    if (segments[3] === "operator") {
      tags.add("operator");
      if (segments[4] === "tasks") tags.add("tasks");
      if (segments[segments.length - 1] === "discourse") tags.add("discourse");
      return { member: null, tags: [...tags], skip: false };
    }
    if (segments[3] === "kanban") {
      return { member: null, tags: ["kanban"], skip: false };
    }
    if (CONTROL_STRUCTURAL_SEGMENTS.has(segments[3])) return none;
    // Remaining control namespaces are member workspaces; the id is data.
    return { member: { id: segments[3], kind: "workspace" }, tags: ["workspace"], skip: false };
  }

  if (segments[2] === "kanban") {
    tags.add("kanban");
    if (segments[3] === "tasks") tags.add("tasks");
    return { member: null, tags: [...tags], skip: false };
  }

  // Generic plugin namespace: keep as a team action; tag media-shaped routes.
  if (segments.includes("media") || segments.includes("tts")) tags.add("media");
  return { member: null, tags: [...tags], skip: false };
}

function actionContract(
  entry: EndpointEntry,
  actionId: string,
  tags: readonly CapabilityKey[],
): TeamActionContract {
  const [primary, ...extra] = entry.methods;
  return {
    id: actionId,
    ...(primary ? { route: { method: primary, path: entry.path } } : { route: { path: entry.path } }),
    capabilities: [...tags],
    metadata: {
      sourceKey: entry.key,
      ...(extra.length ? { methods: entry.methods } : {}),
    },
  };
}

export type TransformHermesCapabilitiesOptions = {
  /** Manifest team id for this gateway instance. Defaults to the provider kind. */
  teamId?: string;
};

export function transformHermesCapabilities(
  payload: unknown,
  options: TransformHermesCapabilitiesOptions = {},
): ResolvedProviderCapabilities {
  if (!isRecord(payload)) {
    throw new Error("Hermes capabilities response failed schema validation");
  }
  if (
    payload.object !== "hermes.api_server.capabilities" ||
    payload.platform !== "hermes-agent"
  ) {
    throw new Error("Hermes capabilities response failed schema validation");
  }

  const features = isRecord(payload.features) ? payload.features : {};
  const supports: CapabilitySupport = {};
  if (features.run_submission === true) supports.runs = true;
  if (
    features.chat_completions_streaming === true ||
    features.responses_streaming === true ||
    features.run_events_sse === true
  ) {
    supports.streaming = true;
  }
  if (features.run_events_sse === true) supports.events = true;
  if (isRecord(payload.endpoints) && isRecord(payload.endpoints.models)) {
    supports.models = true;
  }

  const teamActions: TeamActionContract[] = [];
  const members = new Map<string, ManifestMember & { actions: TeamActionContract[] }>();
  const seenActionIds = new Set<string>();

  const extensions = isRecord(payload.extensions) ? payload.extensions : {};
  const plugins = isRecord(extensions.plugins) ? extensions.plugins : {};
  for (const pluginCapabilities of Object.values(plugins)) {
    if (!isRecord(pluginCapabilities)) continue;
    for (const entry of collectEndpoints(pluginCapabilities.endpoints)) {
      const classified = classify(pathSegments(entry.path));
      if (classified.skip) continue;
      for (const tag of classified.tags) supports[tag] = true;

      if (classified.member) {
        const memberId = classified.member.id;
        let member = members.get(memberId);
        if (!member) {
          member = {
            id: memberId,
            actions: [],
            metadata: { kind: classified.member.kind },
          };
          members.set(memberId, member);
        }
        const prefix = `${memberId}_`;
        const actionId = entry.key.startsWith(prefix)
          ? entry.key.slice(prefix.length)
          : entry.key;
        if (!member.actions.some((action) => action.id === actionId)) {
          member.actions.push(actionContract(entry, actionId, classified.tags));
        }
        continue;
      }

      if (seenActionIds.has(entry.key)) continue;
      seenActionIds.add(entry.key);
      teamActions.push(actionContract(entry, entry.key, classified.tags));
    }
  }

  const providerKind = "hermes";
  const model = asString(payload.model);
  const manifest = normalizeTeamManifest({
    version: TEAM_MANIFEST_VERSION,
    teams: [
      {
        id: options.teamId ?? providerKind,
        identity: {
          name: asString(payload.platform),
          metadata: { ...(model ? { model } : {}) },
        },
        members: [...members.values()],
        actions: teamActions,
      },
    ],
  });

  return { providerKind, supports, manifest };
}

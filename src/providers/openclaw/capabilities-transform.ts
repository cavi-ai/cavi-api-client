import type {
  CapabilityKey,
  CapabilitySupport,
} from "../../core/runtime/capability-taxonomy.js";
import type { ResolvedProviderCapabilities } from "../../contracts/capability-source.js";
import {
  normalizeTeamManifest,
  TEAM_MANIFEST_VERSION,
  type TeamActionContract,
} from "../../contracts/team-manifest.js";
import { OPENCLAW_MANIFEST } from "./manifest.js";

/**
 * Transform an OpenClaw `hello-ok` handshake frame (design decision M1) into
 * the unified `ResolvedProviderCapabilities` shape. The handshake's advertised
 * `features.methods` list is the gateway's runtime capability truth:
 *
 * - `supports` is inferred from method-name prefixes, conservatively — only
 *   positive detections are set; unmentioned keys fall back to the static
 *   declaration during the merge (this is how plugin-gated surfaces stay
 *   honest per instance).
 * - `manifest` actions come from the provider manifest's REST table — imported
 *   constants from the path-owner manifest, never literals. RPC-backed
 *   capabilities (media via tts/talk, wiki via the first-party memory-wiki
 *   plugin's wiki.* methods) need no manifest route; the RPC method table is
 *   their resolver.
 */

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

const METHOD_PREFIX_CAPABILITIES: readonly (readonly [string, readonly CapabilityKey[]])[] = [
  ["chat.", ["runs", "streaming"]],
  ["sessions.", ["sessions"]],
  ["tasks.", ["tasks"]],
  ["models.", ["models"]],
  ["usage.", ["usage"]],
  ["workboard.", ["kanban"]],
  ["agents.", ["workspace"]],
  ["tts.", ["media"]],
  ["talk.", ["media"]],
  // First-party memory-wiki plugin registers wiki.* gateway methods.
  ["wiki.", ["wiki"]],
  ["config.", ["agentConfig"]],
];

function supportsFromMethods(methods: readonly string[]): CapabilitySupport {
  const supports: CapabilitySupport = {};
  for (const method of methods) {
    for (const [prefix, keys] of METHOD_PREFIX_CAPABILITIES) {
      if (method.startsWith(prefix)) {
        for (const key of keys) supports[key] = true;
      }
    }
    if (method === "models.authStatus") supports.authStatus = true;
    if (method.includes("operator")) supports.operator = true;
    if (method.includes("discourse")) supports.discourse = true;
  }
  return supports;
}

/** Convert Express-style `:param` tokens to the manifest's `{param}` form. */
function normalizeRouteTokens(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/gu, "{$1}");
}

function isInvokableRestPath(path: string): boolean {
  if (!path.startsWith("/")) return false; // "<basePath>/..." doc entries
  if (path.includes("...") || path.includes("*")) return false; // doc wildcards
  return true;
}

function restActions(): TeamActionContract[] {
  const actions: TeamActionContract[] = [];
  for (const [key, entry] of Object.entries(OPENCLAW_MANIFEST.rest)) {
    if (!isInvokableRestPath(entry.path)) continue;
    const path = normalizeRouteTokens(entry.path);
    const segments = path.split("/").filter(Boolean);
    // The OpenAI-compat aliases duplicate the RuntimeClient surface; skip.
    if (segments[0] === "v1") continue;
    const tags: CapabilityKey[] = segments[0] === "sessions" ? ["sessions"] : [];
    actions.push({
      id: key,
      route: { method: entry.method === "HEAD" ? "GET" : entry.method, path },
      capabilities: tags,
      metadata: {
        surface: entry.surface,
        auth: entry.auth,
        ...(entry.method === "HEAD" ? { methods: ["HEAD"] } : {}),
      },
    });
  }
  return actions;
}

export type TransformOpenClawHelloOptions = {
  /** Manifest team id for this gateway instance. Defaults to the provider kind. */
  teamId?: string;
};

export function transformOpenClawHello(
  payload: unknown,
  options: TransformOpenClawHelloOptions = {},
): ResolvedProviderCapabilities {
  if (!isRecord(payload) || payload.type !== "hello-ok" || typeof payload.protocol !== "number") {
    throw new Error("OpenClaw hello-ok frame failed schema validation");
  }

  const features = isRecord(payload.features) ? payload.features : {};
  const methods = stringArray(features.methods);
  const supports = supportsFromMethods(methods);
  if (stringArray(features.events).length > 0) supports.events = true;

  // OpenClaw media/wiki are RPC-backed (tts/talk core methods; the first-party
  // memory-wiki plugin's wiki.* methods) — there are no HTTP media/wiki routes
  // to publish; the RPC method table is their resolver. Dedupe on id to keep
  // the manifest normalizer's uniqueness contract.
  const seen = new Set<string>();
  const actions = restActions().filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });

  const providerKind = "openclaw";
  const manifest = normalizeTeamManifest({
    version: TEAM_MANIFEST_VERSION,
    teams: [
      {
        id: options.teamId ?? providerKind,
        identity: {
          name: providerKind,
          metadata: { protocol: payload.protocol },
        },
        members: [],
        actions,
      },
    ],
  });

  return { providerKind, supports, manifest };
}

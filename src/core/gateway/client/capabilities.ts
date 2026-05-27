import {
  extractGatewayCommandCatalog,
  type AgentCommandShortcut,
} from "../agent/commands.js";
import {
  GATEWAY_MEDIA_KINDS,
  type GatewayMediaKind,
  type GatewayMediaProvider,
  type GatewayMediaProviderList,
} from "../resources/media.js";
import type { GatewayCapabilities } from "./client.js";

export type GatewayMediaCapabilityMap = Record<GatewayMediaKind, boolean>;

export type NormalizedGatewayFeatureCapabilities = {
  media: boolean;
  mediaKinds: GatewayMediaCapabilityMap;
  textToSpeech: boolean;
  wiki: boolean;
  sse: boolean;
  websocket: boolean;
  rpc: boolean;
  rpcMethods: readonly string[];
  actions: readonly string[];
  commands: readonly string[];
  rawFeatures: Record<string, unknown>;
};

export type GatewayMediaProviderCapabilityInput =
  | GatewayMediaProviderList
  | readonly GatewayMediaProvider[]
  | readonly GatewayMediaProviderList[];

export type NormalizeGatewayFeatureCapabilitiesOptions = {
  capabilities?: GatewayCapabilities | null;
  mediaProviders?: GatewayMediaProviderCapabilityInput | null;
};

export type GatewayFeatureCapabilityInput =
  | GatewayCapabilities
  | NormalizedGatewayFeatureCapabilities
  | null
  | undefined;

const MEDIA_KIND_KEYS = {
  audio: ["audio", "media.audio", "audioGeneration", "audio_generation"],
  image: ["image", "media.image", "imageGeneration", "image_generation"],
  video: ["video", "media.video", "videoGeneration", "video_generation"],
  music: ["music", "media.music", "musicGeneration", "music_generation"],
} as const satisfies Record<GatewayMediaKind, readonly string[]>;

const TTS_KEYS = [
  "tts",
  "textToSpeech",
  "text_to_speech",
  "speech",
  "speechSynthesis",
  "speech_synthesis",
  "media.tts",
  "media.textToSpeech",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function hasEnabledValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = normalizeName(value);
    return ["available", "enabled", "true", "supported", "ready", "ok"].includes(
      normalized,
    );
  }
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) {
    for (const key of ["enabled", "supported", "available", "configured"] as const) {
      if (key in value) return hasEnabledValue(value[key]);
    }
    if (typeof value.status === "string") return hasEnabledValue(value.status);
    return Object.keys(value).length > 0;
  }
  return false;
}

function collectFeatureValues(
  value: unknown,
  out: Map<string, unknown>,
  prefix = "",
): void {
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    out.set(normalizeKey(name), entry);
    out.set(normalizeKey(key), entry);
    if (isRecord(entry)) {
      collectFeatureValues(entry, out, name);
    }
  }
}

function hasFeature(features: Map<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => {
    const value = features.get(normalizeKey(key));
    return value !== undefined && hasEnabledValue(value);
  });
}

function maybeProviderList(value: unknown): GatewayMediaProviderList | null {
  if (!isRecord(value) || !Array.isArray(value.providers)) return null;
  return value as GatewayMediaProviderList;
}

function flattenMediaProviders(
  input: GatewayMediaProviderCapabilityInput | null | undefined,
): GatewayMediaProvider[] {
  if (!input) return [];
  const directList = maybeProviderList(input);
  if (directList) return [...directList.providers];
  if (!Array.isArray(input)) return [];

  const out: GatewayMediaProvider[] = [];
  for (const entry of input) {
    const list = maybeProviderList(entry);
    if (list) {
      out.push(...list.providers);
      continue;
    }
    if (isRecord(entry) && typeof entry.id === "string") {
      out.push(entry as GatewayMediaProvider);
    }
  }
  return out;
}

function normalizeMediaKind(kind: unknown): GatewayMediaKind | null {
  if (typeof kind !== "string") return null;
  const normalized = normalizeName(kind);
  return GATEWAY_MEDIA_KINDS.includes(normalized as GatewayMediaKind)
    ? (normalized as GatewayMediaKind)
    : null;
}

function providerImpliesKind(provider: GatewayMediaProvider): GatewayMediaKind | null {
  if (provider.configured === false) return null;
  return normalizeMediaKind(provider.kind);
}

function providerImpliesTts(provider: GatewayMediaProvider): boolean {
  if (provider.configured === false) return false;
  if (provider.voices && provider.voices.length > 0) return true;
  if (!provider.metadata) return false;
  return hasEnabledValue(provider.metadata.tts) ||
    hasEnabledValue(provider.metadata.textToSpeech) ||
    hasEnabledValue(provider.metadata.text_to_speech);
}

function tokenizeHint(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map(normalizeKey);
}

function collectEndpointHints(
  capabilities: GatewayCapabilities | null | undefined,
): string[][] {
  if (!capabilities?.endpoints) return [];
  const hints: string[][] = [];
  for (const [name, endpoint] of Object.entries(capabilities.endpoints)) {
    hints.push(tokenizeHint(name));
    if (isRecord(endpoint)) {
      hints.push(...Object.keys(endpoint).map(tokenizeHint));
      if (typeof endpoint.path === "string") hints.push(tokenizeHint(endpoint.path));
    }
  }
  return hints.filter((hint) => hint.length > 0);
}

function endpointHintsInclude(
  endpointHints: readonly (readonly string[])[],
  keys: readonly string[],
): boolean {
  const normalized = keys.map(normalizeKey);
  return endpointHints.some((hint) =>
    normalized.some((key) => hint.includes(key)),
  );
}

function endpointHintsIncludeAll(
  endpointHints: readonly (readonly string[])[],
  keys: readonly string[],
): boolean {
  const normalized = keys.map(normalizeKey);
  return endpointHints.some((hint) =>
    normalized.every((key) => hint.includes(key)),
  );
}

function collectStringEntries(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized) out.add(normalized);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStringEntries(entry, out);
    return;
  }
  if (!isRecord(value)) return;

  for (const key of [
    "id",
    "name",
    "method",
    "action",
    "command",
    "insert",
    "label",
  ] as const) {
    collectStringEntries(value[key], out);
  }
}

function collectNamedCapabilityList(
  capabilities: GatewayCapabilities | null | undefined,
  keys: readonly string[],
): readonly string[] {
  const out = new Set<string>();
  const root: Record<string, unknown> = isRecord(capabilities) ? capabilities : {};
  const features: Record<string, unknown> = isRecord(capabilities?.features)
    ? capabilities.features
    : {};
  const runtime: Record<string, unknown> = isRecord(capabilities?.runtime)
    ? capabilities.runtime
    : {};

  for (const key of keys) {
    collectStringEntries(root[key], out);
    collectStringEntries(features[key], out);
    collectStringEntries(runtime[key], out);
  }
  return [...out];
}

function commandNames(commands: readonly AgentCommandShortcut[]): readonly string[] {
  return commands
    .map((command) => command.insert || command.label)
    .map((command) => command.trim())
    .filter(Boolean);
}

function isNormalized(
  input: GatewayFeatureCapabilityInput,
): input is NormalizedGatewayFeatureCapabilities {
  if (!isRecord(input)) return false;
  const record = input as Record<string, unknown>;
  return typeof record.media === "boolean" &&
    isRecord(record.mediaKinds) &&
    Array.isArray(record.rpcMethods) &&
    Array.isArray(record.actions) &&
    Array.isArray(record.commands);
}

function normalizeInput(
  input: GatewayFeatureCapabilityInput,
): NormalizedGatewayFeatureCapabilities {
  if (isNormalized(input)) return input;
  return normalizeGatewayFeatureCapabilities({ capabilities: input ?? null });
}

export function normalizeGatewayFeatureCapabilities(
  options: NormalizeGatewayFeatureCapabilitiesOptions = {},
): NormalizedGatewayFeatureCapabilities {
  const capabilities = options.capabilities ?? null;
  const rawFeatures = isRecord(capabilities?.features) ? capabilities.features : {};
  const features = new Map<string, unknown>();
  collectFeatureValues(rawFeatures, features);
  collectFeatureValues(capabilities?.runtime, features);

  const endpointHints = collectEndpointHints(capabilities);
  const providers = flattenMediaProviders(options.mediaProviders);
  const mediaKinds = Object.fromEntries(
    GATEWAY_MEDIA_KINDS.map((kind) => {
      const providerSupported = providers.some(
        (provider) => providerImpliesKind(provider) === kind,
      );
      const featureSupported = hasFeature(features, MEDIA_KIND_KEYS[kind]);
      const endpointSupported = endpointHintsIncludeAll(endpointHints, ["media", kind]);
      return [kind, providerSupported || featureSupported || endpointSupported];
    }),
  ) as GatewayMediaCapabilityMap;

  const textToSpeech = hasFeature(features, TTS_KEYS) ||
    providers.some(providerImpliesTts);
  if (textToSpeech) {
    mediaKinds.audio = true;
  }
  const media = Object.values(mediaKinds).some(Boolean) ||
    hasFeature(features, ["media", "mediaGeneration", "media_generation"]) ||
    endpointHintsInclude(endpointHints, ["media"]);
  const wiki = hasFeature(features, ["wiki", "knowledge", "vault"]) ||
    endpointHintsInclude(endpointHints, ["wiki", "vault"]);
  const sse = hasFeature(features, ["sse", "eventStream", "event_stream"]) ||
    endpointHintsInclude(endpointHints, ["events", "stream", "sse"]);
  const websocket = hasFeature(features, ["websocket", "webSocket", "ws"]) ||
    endpointHintsInclude(endpointHints, ["websocket", "socket", "ws"]);
  const rpcMethods = collectNamedCapabilityList(capabilities, [
    "rpcMethods",
    "rpc_methods",
    "methods",
  ]);
  const actions = collectNamedCapabilityList(capabilities, [
    "actions",
    "actionCatalog",
    "action_catalog",
    "tools",
  ]);
  const commands = commandNames(extractGatewayCommandCatalog(capabilities));
  const rpc = rpcMethods.length > 0 ||
    hasFeature(features, ["rpc", "jsonRpc", "json_rpc"]) ||
    websocket;

  return {
    media,
    mediaKinds,
    textToSpeech,
    wiki,
    sse,
    websocket,
    rpc,
    rpcMethods,
    actions,
    commands,
    rawFeatures,
  };
}

export function gatewaySupportsMediaKind(
  input: GatewayFeatureCapabilityInput,
  kind: GatewayMediaKind | string,
): boolean {
  const normalizedKind = normalizeMediaKind(kind);
  if (!normalizedKind) return false;
  return normalizeInput(input).mediaKinds[normalizedKind];
}

export function gatewaySupportsTextToSpeech(
  input: GatewayFeatureCapabilityInput,
): boolean {
  return normalizeInput(input).textToSpeech;
}

export function gatewaySupportsAction(
  input: GatewayFeatureCapabilityInput,
  action: string,
): boolean {
  const normalizedAction = normalizeName(action);
  if (!normalizedAction) return false;
  return normalizeInput(input).actions.some(
    (candidate) => normalizeName(candidate) === normalizedAction,
  );
}

export function gatewaySupportsRpcMethod(
  input: GatewayFeatureCapabilityInput,
  method: string,
): boolean {
  const normalizedMethod = normalizeName(method);
  if (!normalizedMethod) return false;
  return normalizeInput(input).rpcMethods.some(
    (candidate) => normalizeName(candidate) === normalizedMethod,
  );
}

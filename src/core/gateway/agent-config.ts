import { BaseHttpApiClient } from "../http/client.js";
import { isSensitiveKey } from "../http/redaction.js";
import { GATEWAY_AGENT_CONFIG_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../http/types.js";
import { parseAgentVoiceConfig, type AgentVoiceConfig } from "./agent-voice-config.js";

export const AGENT_PROFILE_CONFIG_CONTRACT = "AGENT_PROFILE_CONFIG_V1";
export const AGENT_PROFILE_CONFIG_PATCH_CONTRACT = "AGENT_PROFILE_CONFIG_PATCH_V1";

/** Cookie the shared host-config plugin reads to select the active profile. */
export const PROFILE_COOKIE_NAME = "hermes_profile";

export type AgentConfigFieldValue =
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | Record<string, unknown>;

export type AgentConfigFieldKind =
  | { type: "text"; placeholder?: string }
  | { type: "multiline"; placeholder?: string; minRows?: number }
  | { type: "number"; min?: number; max?: number; step?: number }
  | { type: "toggle" }
  | { type: "select"; options: readonly { value: string; label: string }[] }
  | { type: "chips"; suggestions?: readonly string[] }
  | { type: "list"; placeholder?: string; suggestions?: readonly string[] }
  | { type: "json"; minRows?: number };

export type AgentConfigField = {
  key: string;
  label: string;
  description?: string;
  kind: AgentConfigFieldKind;
  value: AgentConfigFieldValue;
  editable?: boolean;
  sourcePath?: readonly string[];
};

export type AgentConfigSectionId = string;

export type AgentConfigSection = {
  id: AgentConfigSectionId;
  label: string;
  fields: readonly AgentConfigField[];
};

export type AgentConfig = {
  agentId: string;
  agentName: string;
  sourcePath?: string;
  etag?: string;
  sections: readonly AgentConfigSection[];
  voice?: AgentVoiceConfig;
  fetchedAt: number;
};

export type AgentConfigDraftDiff = Record<string, AgentConfigFieldValue>;

export type HermesConfigSchemaField = {
  type?: string;
  description?: string;
  category?: string;
  options?: readonly unknown[];
  min?: number;
  max?: number;
  step?: number;
};

export type HermesConfigSchemaPayload = {
  fields?: Record<string, HermesConfigSchemaField | unknown>;
  category_order?: readonly string[];
};

export type AgentProfileSummary = {
  agentId: string;
  agentName: string;
  sourcePath?: string;
  isActive?: boolean;
  isDefault?: boolean;
  model?: string | null;
  provider?: string | null;
};

export type AgentProfileConfigPatchBody = {
  contract: typeof AGENT_PROFILE_CONFIG_PATCH_CONTRACT;
  version: 1;
  agentId: string;
  profile: string;
  source: "profile-config-yaml";
  sourcePath: string;
  patch: AgentConfigDraftDiff;
  baseEtag?: string;
};

export class GatewayAgentConfigApiError extends Error {
  readonly status?: number;
  readonly path?: string;

  constructor(message: string, options?: { status?: number; path?: string }) {
    super(message);
    this.name = "GatewayAgentConfigApiError";
    this.status = options?.status;
    this.path = options?.path;
  }
}

const AGENT_PROFILE_ID_RE = /^(?:default|[a-z0-9][a-z0-9_-]{0,63})$/u;

const REASONING_EFFORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "none", label: "None" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
] as const;

const CLI_TOOLSET_SUGGESTIONS = [
  "browser",
  "clarify",
  "code_execution",
  "cronjob",
  "delegation",
  "file",
  "image_gen",
  "memory",
  "session_search",
  "skills",
  "terminal",
  "todo",
  "web",
  "webhook",
] as const;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function pathSegments(path: string): readonly string[] {
  return path.split(".").map((segment) => segment.trim()).filter(Boolean);
}

function getPathValue(config: Record<string, unknown>, path: string): unknown {
  let current: unknown = config;
  for (const segment of pathSegments(path)) {
    const record = asRecord(current);
    if (!(segment in record)) return undefined;
    current = record[segment];
  }
  return current;
}

function cloneJsonRecord(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function setPathValue(
  config: Record<string, unknown>,
  path: string,
  value: AgentConfigFieldValue,
): Record<string, unknown> {
  const segments = pathSegments(path);
  if (segments.length === 0) return config;
  const next = cloneJsonRecord(config);
  let cursor: Record<string, unknown> = next;
  for (const segment of segments.slice(0, -1)) {
    const existing = cursor[segment];
    if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
  return next;
}

function flattenConfigPaths(
  value: unknown,
  prefix = "",
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) out[prefix] = value;
    return out;
  }

  const record = asRecord(value);
  const keys = Object.keys(record);
  if (prefix && keys.length === 0) {
    out[prefix] = record;
    return out;
  }
  for (const key of keys) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenConfigPaths(record[key], nextPrefix, out);
  }
  return out;
}

function configFieldValue(value: unknown): AgentConfigFieldValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value as readonly unknown[];
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return String(value ?? "");
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/gu, " ")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

function labelFromPath(path: string): string {
  const segments = pathSegments(path);
  const leaf = segments.length > 0 ? segments[segments.length - 1] : path;
  return titleCase(leaf);
}

function normalizeSchemaField(value: unknown): HermesConfigSchemaField {
  const record = asRecord(value);
  const type = cleanString(record.type);
  const description = cleanString(record.description);
  const category = cleanString(record.category);
  const options = Array.isArray(record.options) ? record.options : undefined;
  return {
    ...(type ? { type } : {}),
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    ...(options ? { options } : {}),
    ...(asNumber(record.min) !== null ? { min: asNumber(record.min) ?? undefined } : {}),
    ...(asNumber(record.max) !== null ? { max: asNumber(record.max) ?? undefined } : {}),
    ...(asNumber(record.step) !== null ? { step: asNumber(record.step) ?? undefined } : {}),
    ...(!type ? { type: "string" } : {}),
  };
}

function inferSchemaType(value: unknown): string {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  if (value !== null && typeof value === "object") return "object";
  return "string";
}

function normalizeSchemaOptions(
  options: readonly unknown[] | undefined,
  currentValue: unknown,
): readonly { value: string; label: string }[] {
  const normalized = (options ?? [])
    .map((option) => {
      const optionRecord = asRecord(option);
      const value =
        cleanString(optionRecord.value) ||
        cleanString(optionRecord.id) ||
        cleanString(optionRecord.name) ||
        (typeof option === "string" || typeof option === "number" || typeof option === "boolean"
          ? String(option)
          : "");
      if (!value) return null;
      const label =
        cleanString(optionRecord.label) ||
        cleanString(optionRecord.name) ||
        value;
      return { value, label };
    })
    .filter((option): option is { value: string; label: string } => option !== null);
  return withOption(
    normalized,
    String(currentValue ?? ""),
    currentValue === null ? "Unset" : undefined,
  );
}

function modelOptionsFromHermesWebuiSnapshot(modelsPayload: unknown): readonly { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (const groupValue of asArray(asRecord(modelsPayload).groups)) {
    const group = asRecord(groupValue);
    for (const modelValue of asArray(group.models)) {
      const model = asRecord(modelValue);
      const value = cleanString(model.id) || cleanString(model.value) || cleanString(model.name);
      if (!value) continue;
      options.push({
        value,
        label: cleanString(model.label) || cleanString(model.name) || value,
      });
    }
  }
  return options;
}

function mcpServerNamesFromHermesWebuiSnapshot(mcpServersPayload: unknown): string[] {
  return asArray(asRecord(mcpServersPayload).servers)
    .map((value) => {
      if (typeof value === "string") return cleanString(value);
      const server = asRecord(value);
      return cleanString(server.name) || cleanString(server.id);
    })
    .filter(Boolean);
}

function buildHermesWebuiSnapshotConfig(input: {
  config?: unknown;
  models?: unknown;
  reasoning?: unknown;
  mcpServers?: unknown;
}): Record<string, unknown> {
  const config = asRecord(input.config);
  if (Object.keys(config).length > 0) return config;

  let synthetic: Record<string, unknown> = {};
  const models = asRecord(input.models);
  const defaultModel = cleanString(models.default_model);
  if (defaultModel) {
    synthetic = setPathValue(synthetic, "model.default", defaultModel);
  }
  const activeProvider = cleanString(models.active_provider);
  if (activeProvider) {
    synthetic = setPathValue(synthetic, "model.provider", activeProvider);
  }

  const reasoning = asRecord(input.reasoning);
  const reasoningEffort = cleanString(reasoning.reasoning_effort);
  if (reasoningEffort) {
    synthetic = setPathValue(synthetic, "agent.reasoning_effort", reasoningEffort);
  }
  const showReasoning = asBoolean(reasoning.show_reasoning);
  if (showReasoning !== null) {
    synthetic = setPathValue(synthetic, "display.show_reasoning", showReasoning);
  }

  const mcpServers = mcpServerNamesFromHermesWebuiSnapshot(input.mcpServers);
  if (mcpServers.length > 0) {
    synthetic = setPathValue(synthetic, "mcp_servers.enabled", mcpServers);
  }

  return synthetic;
}

function buildHermesWebuiSnapshotSchema(input: {
  schema?: unknown;
  models?: unknown;
  reasoning?: unknown;
  mcpServers?: unknown;
}): unknown {
  const schema = asRecord(input.schema);
  if (Object.keys(schema).length > 0) return schema;

  const fields: Record<string, HermesConfigSchemaField> = {};
  const modelOptions = modelOptionsFromHermesWebuiSnapshot(input.models);
  if (cleanString(asRecord(input.models).default_model)) {
    fields["model.default"] = {
      type: modelOptions.length > 0 ? "select" : "string",
      category: "model",
      description: "Default model",
      ...(modelOptions.length > 0 ? { options: modelOptions } : {}),
    };
  }
  if (cleanString(asRecord(input.models).active_provider)) {
    fields["model.provider"] = {
      type: "string",
      category: "model",
      description: "Active provider",
    };
  }
  if (cleanString(asRecord(input.reasoning).reasoning_effort)) {
    fields["agent.reasoning_effort"] = {
      type: "select",
      category: "agent",
      description: "Reasoning effort",
      options: REASONING_EFFORT_OPTIONS,
    };
  }
  if (asBoolean(asRecord(input.reasoning).show_reasoning) !== null) {
    fields["display.show_reasoning"] = {
      type: "boolean",
      category: "display",
      description: "Show reasoning",
    };
  }
  if (mcpServerNamesFromHermesWebuiSnapshot(input.mcpServers).length > 0) {
    fields["mcp_servers.enabled"] = {
      type: "list",
      category: "mcp_servers",
      description: "Enabled MCP servers",
    };
  }

  return Object.keys(fields).length > 0
    ? { fields, category_order: ["model", "agent", "mcp_servers", "display"] }
    : {};
}

export function assertAgentProfileId(agentId: string): string {
  const clean = cleanString(agentId);
  if (!AGENT_PROFILE_ID_RE.test(clean)) {
    throw new GatewayAgentConfigApiError(
      `Invalid agent profile id "${agentId}". Expected "default" or [a-z0-9][a-z0-9_-]{0,63}.`,
    );
  }
  return clean;
}

export function agentProfileConfigPath(agentId: string): string {
  return GATEWAY_AGENT_CONFIG_API_ENDPOINTS.agentConfig(assertAgentProfileId(agentId));
}

export function agentProfileConfigYamlPath(agentId: string): string {
  const id = assertAgentProfileId(agentId);
  return id === "default"
    ? "~/.hermes/config.yaml"
    : `~/.hermes/profiles/${id}/config.yaml`;
}

export function profileCookieHeader(agentId: string): string {
  return `${PROFILE_COOKIE_NAME}=${assertAgentProfileId(agentId)}`;
}

function isMissingRouteError(error: unknown): boolean {
  const status = Number((error as { status?: unknown })?.status);
  return status === 404 || status === 405 || status === 501;
}

function field(input: {
  key: string;
  label: string;
  description?: string;
  kind: AgentConfigFieldKind;
  value: AgentConfigFieldValue;
  editable?: boolean;
  sourcePath?: readonly string[];
}): AgentConfigField {
  return input;
}

function section(
  id: AgentConfigSectionId,
  label: string,
  fields: AgentConfigField[],
): AgentConfigSection | null {
  return fields.length > 0 ? { id, label, fields } : null;
}

function withOption(
  options: readonly { value: string; label: string }[],
  value: string,
  label?: string,
): readonly { value: string; label: string }[] {
  if ((!value && !label) || options.some((option) => option.value === value)) return options;
  return [{ value, label: label || value }, ...options];
}

function normalizeProfiles(payload: unknown): AgentProfileSummary[] {
  const root = asRecord(payload);
  const profiles: AgentProfileSummary[] = [];
  for (const value of asArray(root.profiles)) {
    const profile = asRecord(value);
    const agentId = cleanString(profile.name);
    if (!agentId) continue;
    const sourcePath = cleanString(profile.path);
    const isActive = asBoolean(profile.is_active);
    const isDefault = asBoolean(profile.is_default);
    profiles.push({
      agentId,
      agentName: agentId,
      ...(sourcePath ? { sourcePath } : {}),
      ...(isActive !== null ? { isActive } : {}),
      ...(isDefault !== null ? { isDefault } : {}),
      model: cleanString(profile.model) || null,
      provider: cleanString(profile.provider) || null,
    });
  }
  return profiles;
}

function findProfile(
  profiles: readonly AgentProfileSummary[],
  agentId: string,
): AgentProfileSummary | null {
  return profiles.find((profile) => profile.agentId === agentId) ?? null;
}

function sourcePathForProfile(profile: AgentProfileSummary | null, agentId: string): string {
  if (profile?.sourcePath) {
    const path = profile.sourcePath.trim().replace(/\/+$/u, "");
    return path.endsWith(".yaml") || path.endsWith(".yml")
      ? path
      : `${path}/config.yaml`;
  }
  return agentProfileConfigYamlPath(agentId);
}

function normalizeSchemaPayload(payload: unknown): {
  fields: Record<string, HermesConfigSchemaField>;
  categoryOrder: readonly string[];
} {
  const root = asRecord(payload);
  const fields: Record<string, HermesConfigSchemaField> = {};
  for (const [path, schemaField] of Object.entries(asRecord(root.fields))) {
    if (!path || isSensitiveKey(path)) continue;
    fields[path] = normalizeSchemaField(schemaField);
  }
  return {
    fields,
    categoryOrder: asStringArray(root.category_order),
  };
}

function categoryForPath(path: string, schema?: HermesConfigSchemaField): string {
  return cleanString(schema?.category) || pathSegments(path)[0] || "general";
}

function kindForSchemaField(
  path: string,
  schema: HermesConfigSchemaField | undefined,
  value: unknown,
): AgentConfigFieldKind {
  const type = cleanString(schema?.type).toLowerCase() || inferSchemaType(value);
  if (path === "agent.reasoning_effort") {
    return {
      type: "select",
      options: withOption(REASONING_EFFORT_OPTIONS, String(value ?? "")),
    };
  }
  if (type === "boolean" || type === "bool") return { type: "toggle" };
  if (type === "number" || type === "integer" || type === "float") {
    return {
      type: "number",
      ...(schema?.min !== undefined ? { min: schema.min } : {}),
      ...(schema?.max !== undefined ? { max: schema.max } : {}),
      ...(schema?.step !== undefined ? { step: schema.step } : {}),
    };
  }
  if (type === "select") {
    const options = normalizeSchemaOptions(schema?.options, value);
    return options.length > 0
      ? { type: "select", options }
      : { type: "text", placeholder: path };
  }
  if (type === "list" || Array.isArray(value)) {
    if (path === "platform_toolsets.cli") {
      return { type: "chips", suggestions: CLI_TOOLSET_SUGGESTIONS };
    }
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string" || typeof item === "number")
    ) {
      return { type: "list", placeholder: "comma-separated values" };
    }
    return { type: "json", minRows: 5 };
  }
  if (type === "object" || (value !== null && typeof value === "object")) {
    return { type: "json", minRows: 6 };
  }
  if (
    type === "text" ||
    path.toLowerCase().includes("prompt") ||
    (typeof value === "string" && value.length > 120)
  ) {
    return { type: "multiline", minRows: 4 };
  }
  return { type: "text", placeholder: path };
}

function defaultValueForKind(kind: AgentConfigFieldKind): AgentConfigFieldValue {
  if (kind.type === "toggle") return false;
  if (kind.type === "number") return 0;
  if (kind.type === "chips" || kind.type === "list") return [];
  if (kind.type === "json") return {};
  return "";
}

function compareConfigPaths(
  a: string,
  b: string,
  fields: Record<string, HermesConfigSchemaField>,
  categoryOrder: readonly string[],
): number {
  const aCategory = categoryForPath(a, fields[a]);
  const bCategory = categoryForPath(b, fields[b]);
  const aCategoryIndex = categoryOrder.indexOf(aCategory);
  const bCategoryIndex = categoryOrder.indexOf(bCategory);
  const safeAIndex = aCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : aCategoryIndex;
  const safeBIndex = bCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : bCategoryIndex;
  if (safeAIndex !== safeBIndex) return safeAIndex - safeBIndex;
  if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);
  return a.localeCompare(b);
}

export function buildAgentConfigFromHermesConfigSnapshot(input: {
  agentId: string;
  config: unknown;
  schema?: unknown;
  defaults?: unknown;
  profile?: AgentProfileSummary | null;
  fetchedAt?: number;
  etag?: string;
}): AgentConfig {
  const agentId = assertAgentProfileId(input.agentId);
  const profile = input.profile ?? null;
  const sourcePath = sourcePathForProfile(profile, agentId);
  const config = asRecord(input.config);
  const defaults = asRecord(input.defaults);
  const { fields, categoryOrder } = normalizeSchemaPayload(input.schema ?? {});
  const paths = new Set<string>();

  for (const path of Object.keys(fields)) {
    if (!isSensitiveKey(path)) paths.add(path);
  }
  for (const path of Object.keys(flattenConfigPaths(config))) {
    if (!path.startsWith("_") && !isSensitiveKey(path)) paths.add(path);
  }

  const sectionMap = new Map<string, AgentConfigField[]>();
  for (const path of [...paths].sort((a, b) => compareConfigPaths(a, b, fields, categoryOrder))) {
    const schema = fields[path];
    const configValue = getPathValue(config, path);
    const defaultValue = getPathValue(defaults, path);
    const rawResolvedValue = configValue !== undefined ? configValue : defaultValue;
    const kind = kindForSchemaField(path, schema, rawResolvedValue);
    const resolvedValue =
      rawResolvedValue === undefined
        ? defaultValueForKind(kind)
        : configFieldValue(rawResolvedValue);
    const category = categoryForPath(path, schema);
    const bucket = sectionMap.get(category) ?? [];
    bucket.push(field({
      key: path,
      label: labelFromPath(path),
      description: cleanString(schema?.description) || path,
      kind,
      value: resolvedValue,
      sourcePath: pathSegments(path),
    }));
    sectionMap.set(category, bucket);
  }

  const identitySection = section("profile", "Profile", [
    field({
      key: "profile.name",
      label: "Profile",
      description: "Profile that owns this config",
      kind: { type: "text" },
      value: profile?.agentName || agentId,
      editable: false,
      sourcePath: ["profile", "name"],
    }),
    field({
      key: "profile.configPath",
      label: "Config source",
      description: "Profile config source",
      kind: { type: "text" },
      value: sourcePath,
      editable: false,
      sourcePath: ["profile", "config.yaml"],
    }),
  ]);

  const sectionOrder = [
    ...categoryOrder,
    ...[...sectionMap.keys()].filter((category) => !categoryOrder.includes(category)).sort(),
  ];
  const configSections = sectionOrder
    .map((category) => section(category, titleCase(category), sectionMap.get(category) ?? []))
    .filter((value): value is AgentConfigSection => value !== null);

  const voice = parseAgentVoiceConfig(config);

  return {
    agentId,
    agentName: profile?.agentName || agentId,
    sourcePath,
    ...(input.etag ? { etag: input.etag } : {}),
    sections: [identitySection, ...configSections]
      .filter((value): value is AgentConfigSection => value !== null),
    ...(voice.voices.length > 0 ? { voice } : {}),
    fetchedAt: input.fetchedAt ?? Date.now(),
  };
}

export function buildAgentConfigFromHermesWebuiSnapshot(input: {
  agentId: string;
  profile?: AgentProfileSummary | null;
  profiles?: unknown;
  config?: unknown;
  schema?: unknown;
  defaults?: unknown;
  models?: unknown;
  reasoning?: unknown;
  mcpServers?: unknown;
  fetchedAt?: number;
  etag?: string;
}): AgentConfig {
  const agentId = assertAgentProfileId(input.agentId);
  const profile =
    input.profile ??
    findProfile(normalizeProfiles(input.profiles), agentId) ??
    null;
  return buildAgentConfigFromHermesConfigSnapshot({
    agentId,
    profile,
    config: buildHermesWebuiSnapshotConfig(input),
    schema: buildHermesWebuiSnapshotSchema(input),
    defaults: input.defaults,
    fetchedAt: input.fetchedAt,
    etag: input.etag,
  });
}

function normalizeNativeConfigResponse(payload: unknown, agentId: string): AgentConfig | null {
  const root = asRecord(payload);
  const candidate = asRecord(root.config).sections ? asRecord(root.config) : root;
  if (Array.isArray(candidate.sections)) {
    const voice = parseAgentVoiceConfig(candidate);
    return {
      agentId: cleanString(candidate.agentId) || agentId,
      agentName: cleanString(candidate.agentName) || cleanString(candidate.name) || agentId,
      ...(cleanString(candidate.sourcePath) ? { sourcePath: cleanString(candidate.sourcePath) } : {}),
      ...(cleanString(candidate.etag) ? { etag: cleanString(candidate.etag) } : {}),
      sections: candidate.sections as AgentConfigSection[],
      ...(voice.voices.length > 0 ? { voice } : {}),
      fetchedAt: asNumber(candidate.fetchedAt) ?? Date.now(),
    };
  }

  if (Object.keys(asRecord(root.schema)).length > 0 || Object.keys(asRecord(root.defaults)).length > 0) {
    return buildAgentConfigFromHermesConfigSnapshot({
      agentId,
      config: asRecord(root.config),
      schema: root.schema,
      defaults: root.defaults,
      profile: asRecord(root.profile).name
        ? {
            agentId,
            agentName: cleanString(asRecord(root.profile).name) || agentId,
            sourcePath: cleanString(asRecord(root.profile).path),
          }
        : null,
      fetchedAt: asNumber(root.fetchedAt) ?? Date.now(),
      etag: cleanString(root.etag),
    });
  }

  const rawConfig =
    asRecord(root.rawConfig).model || asRecord(root.rawConfig).agent
      ? asRecord(root.rawConfig)
      : asRecord(root.config);
  if (Object.keys(rawConfig).length > 0) {
    return buildAgentConfigFromHermesConfigSnapshot({
      agentId,
      config: rawConfig,
      profile: asRecord(root.profile).name
        ? {
            agentId,
            agentName: cleanString(asRecord(root.profile).name) || agentId,
            sourcePath: cleanString(asRecord(root.profile).path),
          }
        : null,
      fetchedAt: asNumber(root.fetchedAt) ?? Date.now(),
      etag: cleanString(root.etag),
    });
  }

  return null;
}

export function buildAgentProfileConfigPatchBody(params: {
  agentId: string;
  diff: AgentConfigDraftDiff;
  baseEtag?: string;
  sourcePath?: string;
}): AgentProfileConfigPatchBody {
  const agentId = assertAgentProfileId(params.agentId);
  const patch = Object.fromEntries(
    Object.entries(params.diff).filter(([, value]) => value !== undefined),
  ) as AgentConfigDraftDiff;
  return {
    contract: AGENT_PROFILE_CONFIG_PATCH_CONTRACT,
    version: 1,
    agentId,
    profile: agentId,
    source: "profile-config-yaml",
    sourcePath: cleanString(params.sourcePath) || agentProfileConfigYamlPath(agentId),
    patch,
    ...(params.baseEtag ? { baseEtag: params.baseEtag } : {}),
  };
}

function unsupportedWebuiPatchKeys(diff: AgentConfigDraftDiff): string[] {
  return Object.keys(diff).filter((key) => {
    return key.startsWith("profile.") || isSensitiveKey(key);
  });
}

export type GatewayAgentConfigEndpointMap = {
  profiles: string;
  config: string;
  configDefaults: string;
  configSchema: string;
  agentConfigs: string;
  agentConfig: (agentId: string) => string;
};

export type GatewayAgentConfigApiClientOptions = {
  endpoints?: GatewayAgentConfigEndpointMap;
  surface?: string;
};

export type PatchProfileConfigOptions = {
  baseEtag?: string;
  sourcePath?: string;
};

export interface GatewayAgentConfigClient {
  listProfiles(): Promise<AgentProfileSummary[]>;
  getProfileConfig(agentId: string): Promise<AgentConfig>;
  patchProfileConfig(
    agentId: string,
    diff: AgentConfigDraftDiff,
    options?: PatchProfileConfigOptions,
  ): Promise<AgentConfig>;
}

export class GatewayAgentConfigApiClient
  extends BaseHttpApiClient
  implements GatewayAgentConfigClient
{
  readonly endpoints: GatewayAgentConfigEndpointMap;

  constructor(
    options: HttpApiClientOptions,
    configOptions: GatewayAgentConfigApiClientOptions = {},
  ) {
    super(configOptions.surface ?? "gateway-agent-config-api", options);
    this.endpoints = configOptions.endpoints ?? GATEWAY_AGENT_CONFIG_API_ENDPOINTS;
  }

  private cookieHeaders(agentId: string): Record<string, string> {
    return { Cookie: profileCookieHeader(agentId) };
  }

  async listProfiles(): Promise<AgentProfileSummary[]> {
    try {
      const nativePayload = await this.requestJson<unknown>(this.endpoints.agentConfigs);
      const root = asRecord(nativePayload);
      const nativeProfiles = normalizeProfiles({ profiles: root.agents ?? root.profiles });
      if (nativeProfiles.length > 0) return nativeProfiles;
    } catch (error) {
      if (!isMissingRouteError(error)) throw error;
    }
    return normalizeProfiles(await this.requestJson<unknown>(this.endpoints.profiles));
  }

  async getProfileConfig(agentId: string): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    try {
      const payload = await this.requestJson<unknown>(this.endpoints.agentConfig(id));
      const config = normalizeNativeConfigResponse(payload, id);
      if (!config) {
        throw new GatewayAgentConfigApiError(
          "Agent config API returned an invalid config payload.",
          { path: this.endpoints.agentConfig(id) },
        );
      }
      return config;
    } catch (error) {
      if (!isMissingRouteError(error)) throw error;
      return this.getProfileConfigViaWebui(id);
    }
  }

  protected async getProfileConfigViaWebui(agentId: string): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    const profiles = normalizeProfiles(await this.requestJson<unknown>(this.endpoints.profiles));
    const profile = findProfile(profiles, id);
    if (!profile && id !== "default") {
      throw new GatewayAgentConfigApiError(`Agent profile "${id}" was not found.`, {
        path: this.endpoints.profiles,
        status: 404,
      });
    }

    const headers = this.cookieHeaders(id);
    const [config, schema, defaults] = await Promise.all([
      this.requestJson<unknown>(this.endpoints.config, { headers }),
      this.requestJson<unknown>(this.endpoints.configSchema, { headers }),
      this.requestJson<unknown>(this.endpoints.configDefaults, { headers }),
    ]);

    return buildAgentConfigFromHermesWebuiSnapshot({
      agentId: id,
      profile,
      config,
      schema,
      defaults,
      fetchedAt: Date.now(),
    });
  }

  async patchProfileConfig(
    agentId: string,
    diff: AgentConfigDraftDiff,
    options: PatchProfileConfigOptions = {},
  ): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    const body = buildAgentProfileConfigPatchBody({
      agentId: id,
      diff,
      baseEtag: options.baseEtag,
      sourcePath: options.sourcePath,
    });

    try {
      const payload = await this.requestJson<unknown>(this.endpoints.agentConfig(id), {
        method: "PATCH",
        body,
      });
      const config = normalizeNativeConfigResponse(payload, id);
      if (config) return config;
      return this.getProfileConfig(id);
    } catch (error) {
      if (!isMissingRouteError(error)) throw error;
      return this.patchProfileConfigViaWebui(id, diff);
    }
  }

  protected async patchProfileConfigViaWebui(
    agentId: string,
    diff: AgentConfigDraftDiff,
  ): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    const unsupported = unsupportedWebuiPatchKeys(diff);
    if (unsupported.length > 0) {
      throw new GatewayAgentConfigApiError(
        `These config keys are not editable through the mobile editor: ${unsupported.join(", ")}.`,
      );
    }

    const headers = this.cookieHeaders(id);
    let nextConfig = asRecord(await this.requestJson<unknown>(this.endpoints.config, { headers }));
    for (const [key, value] of Object.entries(diff)) {
      if (value === undefined) continue;
      nextConfig = setPathValue(nextConfig, key, value);
    }
    await this.requestJson(this.endpoints.config, {
      method: "PUT",
      headers,
      body: { config: nextConfig },
    });

    return this.getProfileConfigViaWebui(id);
  }
}

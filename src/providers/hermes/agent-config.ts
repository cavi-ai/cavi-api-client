import {
  GatewayAgentConfigApiClient,
  GatewayAgentConfigApiError,
  assertAgentProfileId,
  buildAgentConfigFromConfigSnapshot,
  findAgentProfile,
  isMissingAgentConfigRouteError,
  normalizeAgentProfiles,
  setAgentConfigPathValue,
  type AgentConfig,
  type AgentConfigDraftDiff,
  type AgentProfileSummary,
  type GatewayConfigSchemaField,
  type PatchProfileConfigOptions,
} from "../../core/gateway/agent/config.js";
import { isSensitiveKey } from "../../core/http/redaction.js";
import { HERMES_AGENT_CONFIG_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

/** Cookie the Hermes host-config plugin reads to select the active profile. */
export const HERMES_PROFILE_COOKIE_NAME = "hermes_profile";

const REASONING_EFFORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "none", label: "None" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
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

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function hermesAgentProfileConfigYamlPath(agentId: string): string {
  const id = assertAgentProfileId(agentId);
  return id === "default"
    ? "~/.hermes/config.yaml"
    : `~/.hermes/profiles/${id}/config.yaml`;
}

export function hermesProfileCookieHeader(agentId: string): string {
  return `${HERMES_PROFILE_COOKIE_NAME}=${assertAgentProfileId(agentId)}`;
}

function modelOptionsFromHermesWebuiSnapshot(
  modelsPayload: unknown,
): readonly { value: string; label: string }[] {
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
    synthetic = setAgentConfigPathValue(synthetic, "model.default", defaultModel);
  }
  const activeProvider = cleanString(models.active_provider);
  if (activeProvider) {
    synthetic = setAgentConfigPathValue(synthetic, "model.provider", activeProvider);
  }

  const reasoning = asRecord(input.reasoning);
  const reasoningEffort = cleanString(reasoning.reasoning_effort);
  if (reasoningEffort) {
    synthetic = setAgentConfigPathValue(synthetic, "agent.reasoning_effort", reasoningEffort);
  }
  const showReasoning = asBoolean(reasoning.show_reasoning);
  if (showReasoning !== null) {
    synthetic = setAgentConfigPathValue(synthetic, "display.show_reasoning", showReasoning);
  }

  const mcpServers = mcpServerNamesFromHermesWebuiSnapshot(input.mcpServers);
  if (mcpServers.length > 0) {
    synthetic = setAgentConfigPathValue(synthetic, "mcp_servers.enabled", mcpServers);
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

  const fields: Record<string, GatewayConfigSchemaField> = {};
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

export function buildAgentConfigFromHermesConfigSnapshot(input: {
  agentId: string;
  config: unknown;
  schema?: unknown;
  defaults?: unknown;
  profile?: AgentProfileSummary | null;
  fetchedAt?: number;
  etag?: string;
}): AgentConfig {
  return buildAgentConfigFromConfigSnapshot({
    ...input,
    defaultSourcePath: hermesAgentProfileConfigYamlPath,
  });
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
    findAgentProfile(normalizeAgentProfiles(input.profiles), agentId) ??
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

function unsupportedHermesWebuiPatchKeys(diff: AgentConfigDraftDiff): string[] {
  return Object.keys(diff).filter((key) => {
    return key.startsWith("profile.") || isSensitiveKey(key);
  });
}

export class HermesAgentConfigApiClient extends GatewayAgentConfigApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, {
      endpoints: HERMES_AGENT_CONFIG_API_ENDPOINTS,
      surface: "hermes-agent-config-api",
      defaultSourcePath: hermesAgentProfileConfigYamlPath,
    });
  }

  override async getProfileConfig(agentId: string): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    try {
      return await super.getProfileConfig(id);
    } catch (error) {
      if (!isMissingAgentConfigRouteError(error)) throw error;
      return this.getProfileConfigViaHermesWebui(id);
    }
  }

  private async getProfileConfigViaHermesWebui(agentId: string): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    const profiles = normalizeAgentProfiles(
      await this.requestJson<unknown>(this.endpoints.profiles),
    );
    const profile = findAgentProfile(profiles, id);
    if (!profile && id !== "default") {
      throw new GatewayAgentConfigApiError(`Agent profile "${id}" was not found.`, {
        path: this.endpoints.profiles,
        status: 404,
      });
    }

    const headers = { Cookie: hermesProfileCookieHeader(id) };
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

  override async patchProfileConfig(
    agentId: string,
    diff: AgentConfigDraftDiff,
    options: PatchProfileConfigOptions = {},
  ): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    try {
      return await super.patchProfileConfig(id, diff, options);
    } catch (error) {
      if (!isMissingAgentConfigRouteError(error)) throw error;
      return this.patchProfileConfigViaHermesWebui(id, diff);
    }
  }

  private async patchProfileConfigViaHermesWebui(
    agentId: string,
    diff: AgentConfigDraftDiff,
  ): Promise<AgentConfig> {
    const id = assertAgentProfileId(agentId);
    const unsupported = unsupportedHermesWebuiPatchKeys(diff);
    if (unsupported.length > 0) {
      throw new GatewayAgentConfigApiError(
        `These config keys are not editable through the mobile editor: ${unsupported.join(", ")}.`,
      );
    }

    const headers = { Cookie: hermesProfileCookieHeader(id) };
    let nextConfig = asRecord(await this.requestJson<unknown>(this.endpoints.config, { headers }));
    for (const [key, value] of Object.entries(diff)) {
      if (value === undefined) continue;
      nextConfig = setAgentConfigPathValue(nextConfig, key, value);
    }
    await this.requestJson(this.endpoints.config, {
      method: "PUT",
      headers,
      body: { config: nextConfig },
    });

    return this.getProfileConfigViaHermesWebui(id);
  }
}

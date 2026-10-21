// OpenClaw agent-config dispatcher. OpenClaw exposes agent configuration over
// RPC (agents.list, config.get, config.schema, config.schema.lookup,
// config.patch, agents.files.list/get/set) rather than generic REST routes.
// RPC method names come from the provider manifest.
//
// Profile reads project the selected agent's config and schema. Mutations send
// an agent-scoped merge patch with the config.get revision as baseHash.

import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../../core/errors.js";
import {
  GatewayAgentConfigApiClient,
  GatewayAgentConfigApiError,
  assertAgentProfileId,
  buildAgentConfigFromConfigSnapshot,
  setAgentConfigPathValue,
} from "../../core/gateway/agent/config.js";
import type {
  AgentConfig,
  AgentConfigDraftDiff,
  AgentProfileSummary,
  PatchProfileConfigOptions,
  GatewayConfigSchemaField,
} from "../../core/gateway/agent/config.js";
import { invalidInputError } from "../../core/error-factories.js";
import { isSensitiveKey, redactSensitiveValue, REDACTION_PLACEHOLDER } from "../../core/http/redaction.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";
import { OPENCLAW_RPC_METHODS } from "./manifest.derive.js";
import type { OpenClawRpcTransport } from "./client.js";

function gated(method: string, rpcHint: string): never {
  throw new ApiClientError(
    `openclaw: ${method} requires an RPC transport (${rpcHint}).`,
    {
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.EndpointNotFound,
    },
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function protocolError(): never {
  throw new ApiClientError("openclaw: invalid profile configuration or schema response", {
    type: ApiClientErrorType.Transport, code: ApiClientErrorCode.TransportProtocolError,
  });
}

function checkValue(value: unknown, depth = 0): void {
  if (depth > 32) throw invalidInputError("Profile configuration is too deeply nested");
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value === "string") {
    if (value.trim() === "__OPENCLAW_REDACTED__" || value.trim() === REDACTION_PLACEHOLDER) {
      throw invalidInputError("Redacted configuration values cannot be submitted");
    }
    return;
  }
  if (Array.isArray(value)) { for (const item of value) checkValue(item, depth + 1); return; }
  const record = asRecord(value);
  if (!record || ![Object.prototype, null].includes(Object.getPrototypeOf(record))) {
    throw invalidInputError("Profile patches must contain JSON values");
  }
  for (const [key, child] of Object.entries(record)) {
    if (key.split(".").some(segment => UNSAFE_KEYS.has(segment)) || isSensitiveKey(key)) {
      throw invalidInputError("Profile patches cannot change sensitive or unsafe keys");
    }
    checkValue(child, depth + 1);
  }
}

function profileSchema(payload: unknown, layout: "entries" | "list") {
  const root = asRecord(asRecord(payload)?.schema) ?? asRecord(payload);
  const agents = asRecord(asRecord(asRecord(root?.properties)?.agents)?.properties);
  const collection = asRecord(agents?.[layout]);
  const entry = asRecord(collection?.[layout === "entries" ? "additionalProperties" : "items"]);
  if (!entry || !asRecord(entry.properties)) return protocolError();
  const fields: Record<string, GatewayConfigSchemaField> = Object.create(null);
  const readonly = new Set<string>();
  let count = 0;
  function visit(node: Record<string, unknown>, path: string, locked: boolean, depth: number): void {
    if (depth > 32 || ++count > 4096) protocolError();
    const properties = asRecord(node.properties);
    locked ||= node.readOnly === true;
    if (properties && Object.keys(properties).length > 0) {
      for (const [key, value] of Object.entries(properties)) {
        if ((key === "id" && !path) || UNSAFE_KEYS.has(key) || isSensitiveKey(key)) continue;
        const child = asRecord(value);
        if (!child) protocolError();
        visit(child, path ? `${path}.${key}` : key, locked, depth + 1);
      }
    } else if (path) {
      fields[path] = {
        type: typeof node.type === "string" ? node.type : undefined,
        description: typeof node.description === "string" ? node.description : undefined,
        options: Array.isArray(node.enum) ? node.enum : undefined,
        min: typeof node.minimum === "number" ? node.minimum : undefined,
        max: typeof node.maximum === "number" ? node.maximum : undefined,
      };
      if (locked) readonly.add(path);
    }
  }
  visit(entry, "", false, 0);
  return { fields, readonly };
}

/**
 * Map the OpenClaw `agents.list` RPC payload onto the unified profile summary.
 * Verified live (2026-07-23): `{ defaultId, mainKey, scope, agents: [{ id,
 * name, workspace, agentRuntime, ... }] }`.
 */
export function normalizeOpenClawAgentProfiles(payload: unknown): AgentProfileSummary[] {
  const root = asRecord(payload);
  if (!root) return [];
  const defaultId = cleanString(root.defaultId);
  const agents = Array.isArray(root.agents) ? root.agents : [];
  const profiles: AgentProfileSummary[] = [];
  for (const value of agents) {
    const agent = asRecord(value);
    const agentId = cleanString(agent?.id);
    if (!agentId) continue;
    const sourcePath = cleanString(agent?.workspace);
    const runtime = asRecord(agent?.agentRuntime);
    profiles.push({
      agentId,
      agentName: cleanString(agent?.name) ?? agentId,
      ...(sourcePath ? { sourcePath } : {}),
      ...(defaultId ? { isDefault: agentId === defaultId } : {}),
      model: cleanString(runtime?.id) ?? null,
      provider: null,
    });
  }
  return profiles;
}

export type OpenClawAgentConfigApiClientOptions = HttpApiClientOptions & {
  /** Shared OpenClaw socket for RPC dispatch (injected by createApiClient). */
  rpcClient?: OpenClawRpcTransport | null;
};

export class OpenClawAgentConfigApiClient extends GatewayAgentConfigApiClient {
  private readonly rpcClient: OpenClawRpcTransport | null;

  constructor(options: OpenClawAgentConfigApiClientOptions) {
    super(options, { surface: "openclaw-agent-config-api" });
    this.rpcClient = options.rpcClient ?? null;
  }

  override async listProfiles(): Promise<AgentProfileSummary[]> {
    if (!this.rpcClient) return gated("listProfiles", OPENCLAW_RPC_METHODS.agentsList);
    const payload = await this.rpcClient.request<unknown>(OPENCLAW_RPC_METHODS.agentsList, {});
    return normalizeOpenClawAgentProfiles(payload);
  }

  private async readProfile(agentId: string) {
    agentId = assertAgentProfileId(agentId);
    if (UNSAFE_KEYS.has(agentId)) throw invalidInputError("Invalid profile identity");
    if (!this.rpcClient) return gated("getProfileConfig", OPENCLAW_RPC_METHODS.configGet);
    const profiles = await this.listProfiles();
    const profile = profiles.find(value => value.agentId === agentId);
    if (!profile) throw new ApiClientError("openclaw: agent profile was not found", { code: ApiClientErrorCode.EndpointNotFound });
    const snapshot = asRecord(await this.rpcClient.request(OPENCLAW_RPC_METHODS.configGet, {}));
    if (snapshot?.valid !== true || snapshot.writeError) {
      throw new ApiClientError("openclaw: configuration is not valid for editing", { code: ApiClientErrorCode.InvalidConfig });
    }
    const config = asRecord(snapshot.config);
    const hash = cleanString(snapshot.hash);
    const path = cleanString(snapshot.path);
    if (!config || !hash || !path) return protocolError();
    const agents = asRecord(config.agents) ?? {};
    const entries = asRecord(agents.entries);
    const list = agents.list;
    if ((agents.entries !== undefined && !entries) || (list !== undefined && !Array.isArray(list))) return protocolError();
    const layout = entries || list === undefined ? "entries" as const : "list" as const;
    const selected = entries
      ? Object.prototype.hasOwnProperty.call(entries, agentId) ? asRecord(entries[agentId]) : null
      : Array.isArray(list) ? list.map(asRecord).find(value => value?.id === agentId) ?? null : null;
    if (!selected && (entries || list !== undefined || !profile.isDefault || profiles.length !== 1)) {
      throw new ApiClientError("openclaw: agent has no editable configuration", { code: ApiClientErrorCode.EndpointNotFound });
    }
    const { id: _id, ...overrides } = selected ?? {};
    const schema = profileSchema(await this.rpcClient.request(OPENCLAW_RPC_METHODS.configSchema, {}), layout);
    return { agentId, profile, overrides, defaults: asRecord(agents.defaults) ?? {}, hash, path, layout, schema };
  }

  private projectProfile(data: Awaited<ReturnType<OpenClawAgentConfigApiClient["readProfile"]>>): AgentConfig {
    const config = buildAgentConfigFromConfigSnapshot({
      agentId: data.agentId, config: data.overrides, defaults: data.defaults,
      schema: { fields: data.schema.fields }, etag: data.hash,
      profile: { ...data.profile, agentName: cleanString(data.overrides.name) ?? data.profile.agentName, sourcePath: undefined },
      defaultSourcePath: () => data.path,
    });
    return { ...config, sections: config.sections.map(section => ({
      ...section, fields: section.fields.filter(field => field.key.startsWith("profile.") ||
        Object.prototype.hasOwnProperty.call(data.schema.fields, field.key)).map(field => {
        let editable = field.editable !== false && !data.schema.readonly.has(field.key);
        try { checkValue(field.value); } catch { editable = false; }
        return { ...field, value: redactSensitiveValue(field.value) as typeof field.value, editable };
      }),
    })).filter(section => section.fields.length > 0) };
  }

  override async getProfileConfig(agentId: string): Promise<AgentConfig> {
    return this.projectProfile(await this.readProfile(agentId));
  }

  override async patchProfileConfig(
    agentId: string,
    diff: AgentConfigDraftDiff,
    options: PatchProfileConfigOptions = {},
  ): Promise<AgentConfig> {
    checkValue(diff);
    const data = await this.readProfile(agentId);
    if (options.baseEtag && options.baseEtag !== data.hash) {
      throw new GatewayAgentConfigApiError("OpenClaw configuration changed; reload before editing", { status: 409 });
    }
    if (options.sourcePath && options.sourcePath !== data.path) throw invalidInputError("Configuration source changed; reload before editing");
    const editable = new Set(this.projectProfile(data).sections.flatMap(section => section.fields)
      .filter(field => field.editable !== false).map(field => field.key));
    let patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(diff)) {
      if (!editable.has(key)) {
        throw invalidInputError("Patch keys must name editable profile fields");
      }
      patch = setAgentConfigPathValue(patch, key, value);
    }
    if (Object.keys(patch).length === 0) return this.projectProfile(data);
    const agents = data.layout === "entries" ? { entries: { [data.agentId]: patch } } : { list: [{ id: data.agentId, ...patch }] };
    const response = asRecord(await this.rpcClient!.request(OPENCLAW_RPC_METHODS.configPatch, {
      baseHash: data.hash, raw: JSON.stringify({ agents }),
    }));
    if (response?.ok !== true) return protocolError();
    return this.getProfileConfig(data.agentId);
  }
}

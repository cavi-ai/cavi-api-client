import { toError } from "../../../core/errors.js";
import type {
  RuntimeAuthStatus,
  RuntimeModelDescriptor,
} from "../../../core/runtime/control-plane/models.js";
import type { RuntimeControlPlaneMetadata } from "../../../core/runtime/control-plane/types.js";

import { normalizeTimestamp } from "./normalize.js";
import type { OpenClawRpc } from "./rpc.js";
import { parseOpenClaw } from "./protocol-error.js";
import { parseModelsAuthStatus, parseModelsList } from "./wire.js";

type RequestOptions = { signal?: AbortSignal };
type ModelsListOptions = RequestOptions & { cursor?: string; limit?: number };
type WireModel = {
  id: string;
  name: string;
  provider: string;
  alias?: string;
  contextWindow?: number;
  reasoning?: boolean;
};
type WireAuthProfile = {
  profileId: string;
  type: string;
  status: string;
  reasonCode?: string;
  expiry?: WireAuthExpiry;
  logoutSupported?: boolean;
};
type WireAuthExpiry = { at: number; remainingMs: number; label: string };
type WireAuthUsage = {
  windows: Array<{ label: string; usedPercent: number; resetAt?: number }>;
  summary?: string;
  plan?: string;
  billing?: Array<Record<string, unknown>>;
};
type WireAuthProvider = {
  provider: string;
  displayName: string;
  status: string;
  expiry?: WireAuthExpiry;
  profiles: WireAuthProfile[];
  usage?: WireAuthUsage;
};

function metadata(method: string, providerData?: Record<string, unknown>): RuntimeControlPlaneMetadata {
  const result: RuntimeControlPlaneMetadata = {
    provider: "openclaw",
    stability: "experimental",
    source: { transport: "websocket", method },
  };
  if (providerData && Object.keys(providerData).length > 0) result.providerData = providerData;
  return result;
}

async function request(rpc: OpenClawRpc, method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  try {
    return await rpc.request(method, params, { signal });
  } catch (error) {
    throw toError(error, `OpenClaw ${method} request failed`);
  }
}

function authState(status: string): RuntimeAuthStatus["status"] {
  if (["healthy", "authenticated", "valid"].includes(status)) return "authenticated";
  if (["missing", "unauthenticated"].includes(status)) return "unauthenticated";
  if (status === "expired") return "expired";
  return "unknown";
}

function mapModel(model: WireModel): RuntimeModelDescriptor {
  const capabilities = model.reasoning === undefined ? undefined : { reasoning: model.reasoning };
  const providerData: Record<string, unknown> = {};
  if (model.alias !== undefined) providerData.alias = model.alias;
  if (model.contextWindow !== undefined) providerData.contextWindow = model.contextWindow;
  return {
    providerId: model.provider,
    id: model.id,
    displayName: model.name,
    availability: "available",
    ...(capabilities === undefined ? {} : { capabilities }),
    metadata: metadata("models.list", providerData),
  };
}

function mapAuthProvider(provider: WireAuthProvider, checkedAt: string): RuntimeAuthStatus[] {
  const profiles: Array<WireAuthProfile | undefined> = provider.profiles.length === 0
    ? [undefined]
    : provider.profiles;
  return profiles.map((profile) => {
    const upstreamStatus = profile?.status ?? provider.status;
    const providerData: Record<string, unknown> = {
      checkedAt,
      displayName: provider.displayName,
      upstreamStatus,
    };
    if (profile?.logoutSupported !== undefined) providerData.logoutSupported = profile.logoutSupported;
    if (provider.usage !== undefined) providerData.usage = provider.usage;
    const expiry = profile?.expiry ?? (profile === undefined ? provider.expiry : undefined);
    return {
      providerId: provider.provider,
      ...(profile === undefined ? {} : { profileId: profile.profileId, sourceCategory: profile.type }),
      status: authState(upstreamStatus),
      ...(expiry === undefined ? {} : { expiresAt: normalizeTimestamp(expiry.at) }),
      ...(profile?.reasonCode === undefined ? {} : { reasonCode: profile.reasonCode }),
      metadata: metadata("models.authStatus", providerData),
    };
  });
}

export function createOpenClawModelCatalogClient(rpc: OpenClawRpc) {
  return {
    async listModels(options: ModelsListOptions = {}) {
      const payload = await request(rpc, "models.list", { view: "configured" }, options.signal);
      return parseOpenClaw("models.list", () => {
        const parsed = parseModelsList(payload);
        return { data: (parsed.models as WireModel[]).map(mapModel) };
      });
    },
  };
}

export function createOpenClawAuthStatusClient(rpc: OpenClawRpc) {
  return {
    async listAuthStatus(options: RequestOptions = {}): Promise<readonly RuntimeAuthStatus[]> {
      const payload = await request(rpc, "models.authStatus", {}, options.signal);
      return parseOpenClaw("models.authStatus", () => {
        const parsed = parseModelsAuthStatus(payload);
        const checkedAt = normalizeTimestamp(parsed.ts);
        return (parsed.providers as WireAuthProvider[]).flatMap((provider) => mapAuthProvider(provider, checkedAt));
      });
    },
  };
}

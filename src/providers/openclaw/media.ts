// OpenClaw media dispatcher. Implements the unified `GatewayMediaClient`
// contract by routing each UI call to OpenClaw's native surface:
//
//   - `tts.providers` (RPC) for audio provider inventory.
//   - `tts.convert` (RPC) for audio / text-to-speech generation.
//
// Image, video, and music generation are not part of OpenClaw's core RPC
// surface (`docs/providers/openclaw/api-endpoints.md`); those methods throw
// `ApiClientError(EndpointNotFound)` with a clear message until an OpenClaw
// plugin manifest registers routes for them (see plan §5: future
// `withCaviControlMediaRoutes` enrichment).

import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
  getErrorMessage,
} from "../../core/errors.js";
import { GatewayMediaApiClient } from "../../core/gateway/resources/media.js";
import type {
  GatewayMediaAsset,
  GatewayMediaAssetDeleteResult,
  GatewayMediaAssetList,
  GatewayMediaAssetListOptions,
  GatewayMediaAssetRequest,
  GatewayMediaAssetUploadRequest,
  GatewayMediaGenerateInput,
  GatewayMediaGenerateRequest,
  GatewayMediaGenerationResult,
  GatewayMediaJobWaitOptions,
  GatewayMediaKind,
  GatewayMediaProviderList,
  GatewayTextToSpeechRequest,
} from "../../core/gateway/resources/media.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";
import { resolveHttpWebSocketTargets } from "../../core/ws/index.js";
import { OPENCLAW_RPC_METHODS } from "./manifest.derive.js";
import {
  OpenClawWebSocketClient,
  type OpenClawWebSocketClientOptions,
} from "./websocket.js";
import type { OpenClawRpcTransport } from "./client.js";

export type OpenClawMediaApiClientOptions = HttpApiClientOptions & {
  /** Optional shared RPC transport (e.g. from an existing `OpenClawApiClient`). */
  rpcClient?: OpenClawRpcTransport | null;
  /** Explicit WebSocket URL when not derivable from `baseUrl`. */
  wsUrl?: string;
  rpcClientOptions?: OpenClawWebSocketClientOptions;
};

type GeneratedJobEnvelope = {
  jobId?: string | null;
  id?: string | null;
  status?: string | null;
  provider?: string | null;
  format?: string | null;
  audioUrl?: string | null;
  url?: string | null;
};

function gated(method: string, hint: string): never {
  throw new ApiClientError(
    `openclaw: ${method} is not part of the core OpenClaw RPC surface. ${hint}`,
    {
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.EndpointNotFound,
    },
  );
}

function normalizeProviderListPayload(payload: unknown): GatewayMediaProviderList {
  if (payload && typeof payload === "object") {
    const record = payload as { providers?: unknown };
    if (Array.isArray(record.providers)) {
      return payload as GatewayMediaProviderList;
    }
    if (Array.isArray(payload)) {
      return { providers: payload as GatewayMediaProviderList["providers"] };
    }
  }
  return { providers: [] };
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return undefined;
}

function normalizeTtsResponse(
  payload: unknown,
  fallbackKind: GatewayMediaKind,
): GatewayMediaGenerationResult {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown> & GeneratedJobEnvelope)
      : ({} as Record<string, unknown> & GeneratedJobEnvelope);

  const status = pickString(record, "status", "state") ?? "completed";
  const result: GatewayMediaGenerationResult = {
    status,
    kind: fallbackKind,
  };

  const jobId = pickString(record, "jobId", "job_id");
  if (jobId) result.jobId = jobId;
  const id = pickString(record, "id");
  if (id) result.id = id;

  const url = pickString(record, "audioUrl", "url", "audio_url");
  const contentType = pickString(record, "format", "audioFormat", "contentType");
  if (url || contentType) {
    const asset: { kind: GatewayMediaKind; url?: string; contentType?: string } = {
      kind: fallbackKind,
    };
    if (url) asset.url = url;
    if (contentType) asset.contentType = contentType;
    result.asset = asset;
  }

  return result;
}

export class OpenClawMediaApiClient extends GatewayMediaApiClient {
  private readonly wsUrl?: string;
  private readonly rpcClientOverride: OpenClawRpcTransport | null;
  private readonly rpcClientOptions?: OpenClawWebSocketClientOptions;
  private rpcClient: OpenClawRpcTransport | null = null;

  constructor(options: OpenClawMediaApiClientOptions) {
    super(options, { surface: "openclaw-media-api" });
    this.wsUrl = options.wsUrl;
    this.rpcClientOverride = options.rpcClient ?? null;
    this.rpcClientOptions = options.rpcClientOptions;
  }

  override async listMediaProviders(
    kind?: GatewayMediaKind | null,
  ): Promise<GatewayMediaProviderList> {
    if (kind && kind !== "audio") {
      gated(
        `listMediaProviders(${kind})`,
        `Only audio providers are advertised via tts.providers; install a plugin to expose ${kind} providers.`,
      );
    }
    const payload = await this.getRpcClient().request<unknown>(
      OPENCLAW_RPC_METHODS.ttsProviders,
    );
    return normalizeProviderListPayload(payload);
  }

  override async generateAudio(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.convertViaTts(
      body.input,
      { ...body, idempotencyKey },
      "audio",
    );
  }

  override async generateTextToSpeech(
    body: GatewayTextToSpeechRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.convertViaTts(
      body.text,
      { ...body, idempotencyKey },
      "audio",
    );
  }

  override async generateMedia(
    body: GatewayMediaGenerateRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    if (body.kind === "audio") {
      const { kind: _kind, ...rest } = body;
      return this.generateAudio(rest as GatewayMediaGenerateInput, idempotencyKey);
    }
    gated(
      `generateMedia(kind=${body.kind})`,
      `OpenClaw core RPC only generates audio via tts.convert. Install a plugin to enable ${body.kind} generation.`,
    );
  }

  override async generateImage(
    _body: GatewayMediaGenerateInput,
    _idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return gated(
      "generateImage",
      "Install an OpenClaw plugin that registers image generation routes (e.g. cavi-control).",
    );
  }

  override async generateVideo(
    _body: GatewayMediaGenerateInput,
    _idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return gated(
      "generateVideo",
      "Install an OpenClaw plugin that registers video generation routes (e.g. cavi-control).",
    );
  }

  override async generateMusic(
    _body: GatewayMediaGenerateInput,
    _idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return gated(
      "generateMusic",
      "Install an OpenClaw plugin that registers music generation routes.",
    );
  }

  override async getMediaJob(
    _kind: GatewayMediaKind,
    _jobId: string,
  ): Promise<GatewayMediaGenerationResult> {
    return gated(
      "getMediaJob",
      "OpenClaw core does not expose a media job polling RPC; plugin-supplied jobs are polled via the plugin's own surface.",
    );
  }

  override async waitForMediaJob(
    _kind: GatewayMediaKind,
    _jobId: string,
    _options?: GatewayMediaJobWaitOptions,
  ): Promise<GatewayMediaGenerationResult> {
    return gated(
      "waitForMediaJob",
      "OpenClaw core does not expose a media job polling RPC; plugin-supplied jobs are polled via the plugin's own surface.",
    );
  }

  override async listMediaAssets(
    _options?: GatewayMediaAssetListOptions,
  ): Promise<GatewayMediaAssetList> {
    return gated(
      "listMediaAssets",
      "OpenClaw core does not catalog generated media via RPC; install a plugin to expose an asset registry.",
    );
  }

  override async getMediaAssetMetadata(_assetId: string): Promise<GatewayMediaAsset> {
    return gated(
      "getMediaAssetMetadata",
      "OpenClaw core does not expose an asset metadata RPC.",
    );
  }

  override async createMediaAsset(
    _body: GatewayMediaAssetUploadRequest,
    _idempotencyKey?: string,
  ): Promise<GatewayMediaAsset> {
    return gated(
      "createMediaAsset",
      "OpenClaw core does not expose an asset creation RPC; install a plugin to enable.",
    );
  }

  override async uploadMediaAsset(
    _body: GatewayMediaAssetUploadRequest,
    _idempotencyKey?: string,
  ): Promise<GatewayMediaAsset> {
    return gated(
      "uploadMediaAsset",
      "OpenClaw core does not expose an asset upload RPC; install a plugin to enable.",
    );
  }

  override async deleteMediaAsset(_assetId: string): Promise<GatewayMediaAssetDeleteResult> {
    return gated(
      "deleteMediaAsset",
      "OpenClaw core does not expose an asset deletion RPC.",
    );
  }

  override async getMediaAsset(_assetId: string, _init?: GatewayMediaAssetRequest): Promise<Blob> {
    return gated(
      "getMediaAsset",
      "OpenClaw core managed-media bytes are served at /api/chat/media/outgoing/... — provider-supplied resolver TBD.",
    );
  }

  override async getAudioAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob> {
    return this.getMediaAsset(assetId, init);
  }

  override async getImageAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob> {
    return this.getMediaAsset(assetId, init);
  }

  override async getVideoAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob> {
    return this.getMediaAsset(assetId, init);
  }

  override async getMusicAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob> {
    return this.getMediaAsset(assetId, init);
  }

  // --- internals ---

  private async convertViaTts(
    input: string,
    body: Record<string, unknown>,
    kind: GatewayMediaKind,
  ): Promise<GatewayMediaGenerationResult> {
    const trimmed = typeof input === "string" ? input.trim() : "";
    if (!trimmed) {
      throw new ApiClientError(
        "openclaw media: tts.convert requires a non-empty `input` / `text`.",
        {
          type: ApiClientErrorType.Validation,
          code: ApiClientErrorCode.ValidationFailed,
        },
      );
    }
    const params: Record<string, unknown> = {
      text: trimmed,
    };
    for (const key of [
      "format",
      "provider",
      "voiceId",
      "voice",
      "speed",
      "pitch",
      "style",
      "options",
      "idempotencyKey",
      "metadata",
    ] as const) {
      const value = body[key];
      if (value !== undefined) params[key] = value;
    }
    const payload = await this.getRpcClient().request<unknown>(
      OPENCLAW_RPC_METHODS.ttsConvert,
      params,
    );
    return normalizeTtsResponse(payload, kind);
  }

  private getRpcClient(): OpenClawRpcTransport {
    if (this.rpcClientOverride) return this.rpcClientOverride;
    if (this.rpcClient) return this.rpcClient;
    let wsUrl = this.wsUrl;
    if (!wsUrl) {
      try {
        wsUrl = resolveHttpWebSocketTargets(this.baseUrl).wsUrl;
      } catch (error) {
        throw new ApiClientError(
          `OpenClawMediaApiClient requires an absolute baseUrl or explicit wsUrl for WebSocket RPC: ${getErrorMessage(error)}`,
          {
            type: ApiClientErrorType.Configuration,
            code: ApiClientErrorCode.InvalidConfig,
            cause: error,
          },
        );
      }
    }
    this.rpcClient = new OpenClawWebSocketClient(wsUrl, this.authToken || null, {
      ...this.rpcClientOptions,
      clientId: this.rpcClientOptions?.clientId ?? this.clientId,
    });
    return this.rpcClient;
  }
}

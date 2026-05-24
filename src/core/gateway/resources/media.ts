import { GATEWAY_MEDIA_API_ENDPOINTS } from "../../../contracts/paths.js";
import { BaseHttpApiClient } from "../../http/client.js";
import type { HttpApiClientOptions, HttpApiRequestInit } from "../../http/types.js";
import {
  waitForGatewayJob,
  type GatewayJobWaitOptions,
} from "../jobs.js";

export const GATEWAY_MEDIA_KINDS = ["audio", "image", "video", "music"] as const;

export type GatewayMediaKind = (typeof GATEWAY_MEDIA_KINDS)[number];

export const GATEWAY_MEDIA_ACCEPT_HEADERS = {
  audio: "audio/*",
  image: "image/*",
  video: "video/*",
  music: "audio/*",
} as const satisfies Record<GatewayMediaKind, string>;

export type GatewayMediaJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly GatewayMediaJsonValue[]
  | { readonly [key: string]: GatewayMediaJsonValue };

export type GatewayMediaEndpointMap = {
  providers: (kind?: GatewayMediaKind | null) => string;
  generate: (kind: GatewayMediaKind) => string;
  job: (kind: GatewayMediaKind, jobId: string) => string;
  assets: (query?: GatewayMediaAssetListOptions | null) => string;
  asset: (assetId: string) => string;
};

export type GatewayMediaProvider = {
  id: string;
  kind?: GatewayMediaKind | string;
  label?: string;
  name?: string;
  configured?: boolean;
  models?: readonly string[];
  voices?: readonly (string | { id: string; name?: string })[];
  metadata?: Record<string, unknown>;
};

export type GatewayMediaProviderList = {
  object?: string;
  kind?: GatewayMediaKind | string;
  providers: readonly GatewayMediaProvider[];
};

export type GatewayMediaGenerateRequest = {
  kind: GatewayMediaKind;
  input: string;
  instructions?: string;
  providerId?: string;
  model?: string;
  voiceId?: string;
  format?: string;
  durationSeconds?: number;
  teamId?: string;
  memberId?: string;
  actionId?: string;
  options?: Record<string, GatewayMediaJsonValue>;
  metadata?: Record<string, unknown>;
};

export type GatewayMediaGenerateInput = Omit<GatewayMediaGenerateRequest, "kind">;

export type GatewayTextToSpeechRequest = Omit<
  GatewayMediaGenerateInput,
  "input"
> & {
  text: string;
};

export type GatewayMediaAsset = {
  id?: string;
  kind?: GatewayMediaKind | string;
  contentType?: string;
  filename?: string;
  path?: string;
  url?: string;
  size?: number;
  metadata?: Record<string, unknown>;
};

export type GatewayMediaAssetListOptions = {
  kind?: GatewayMediaKind | string | null;
  cursor?: string | null;
  limit?: number | null;
};

export type GatewayMediaAssetList = {
  object?: string;
  kind?: GatewayMediaKind | string;
  assets: readonly GatewayMediaAsset[];
  nextCursor?: string | null;
  metadata?: Record<string, unknown>;
};

export type GatewayMediaAssetUploadRequest = {
  kind: GatewayMediaKind | string;
  input?: string;
  filename?: string;
  contentType?: string;
  dataBase64?: string;
  url?: string;
  size?: number;
  options?: Record<string, GatewayMediaJsonValue>;
  metadata?: Record<string, unknown>;
};

export type GatewayMediaAssetDeleteResult = {
  object?: string;
  id?: string;
  assetId?: string;
  deleted?: boolean;
  status: string;
  metadata?: Record<string, unknown>;
};

export type GatewayMediaGenerationResult = {
  object?: string;
  id?: string;
  jobId?: string;
  runId?: string;
  kind?: GatewayMediaKind | string;
  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | string;
  asset?: GatewayMediaAsset;
  artifacts?: readonly GatewayMediaAsset[];
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayMediaJobWaitOptions = Omit<
  GatewayJobWaitOptions<GatewayMediaGenerationResult>,
  "fetchJob"
>;

export type GatewayMediaAssetRequest = Pick<
  HttpApiRequestInit,
  "cache" | "credentials" | "headers" | "signal" | "timeoutMs"
> & {
  accept?: string;
};

export type GatewayMediaApiClientOptions = {
  endpoints?: GatewayMediaEndpointMap;
  surface?: string;
};

export interface GatewayMediaClient {
  listMediaProviders(
    kind?: GatewayMediaKind | null,
  ): Promise<GatewayMediaProviderList>;
  generateMedia(
    body: GatewayMediaGenerateRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  generateAudio(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  generateImage(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  generateVideo(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  generateMusic(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  generateTextToSpeech(
    body: GatewayTextToSpeechRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  getMediaJob(
    kind: GatewayMediaKind,
    jobId: string,
  ): Promise<GatewayMediaGenerationResult>;
  waitForMediaJob(
    kind: GatewayMediaKind,
    jobId: string,
    options?: GatewayMediaJobWaitOptions,
  ): Promise<GatewayMediaGenerationResult>;
  listMediaAssets(
    options?: GatewayMediaAssetListOptions,
  ): Promise<GatewayMediaAssetList>;
  getMediaAssetMetadata(assetId: string): Promise<GatewayMediaAsset>;
  createMediaAsset(
    body: GatewayMediaAssetUploadRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaAsset>;
  uploadMediaAsset(
    body: GatewayMediaAssetUploadRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaAsset>;
  deleteMediaAsset(assetId: string): Promise<GatewayMediaAssetDeleteResult>;
  getMediaAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
  getAudioAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
  getImageAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
  getVideoAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
  getMusicAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
}

function normalizeMediaKind(kind: GatewayMediaKind | string): GatewayMediaKind {
  const normalized = kind.trim().toLowerCase();
  if (GATEWAY_MEDIA_KINDS.includes(normalized as GatewayMediaKind)) {
    return normalized as GatewayMediaKind;
  }
  throw new Error(`gateway media: unsupported media kind "${kind}"`);
}

function requiredText(value: string | null | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`gateway media: missing ${label}`);
  }
  return normalized;
}

function optionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeListOptions(
  options: GatewayMediaAssetListOptions = {},
): GatewayMediaAssetListOptions {
  const kind = options.kind == null ? undefined : normalizeMediaKind(options.kind);
  const cursor = optionalText(options.cursor);
  const limit = options.limit ?? undefined;
  if (
    limit !== undefined &&
    (!Number.isFinite(limit) || limit <= 0 || Math.floor(limit) !== limit)
  ) {
    throw new Error("gateway media: asset list limit must be a positive integer");
  }
  return {
    ...(kind ? { kind } : {}),
    ...(cursor ? { cursor } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function normalizeAssetUploadRequest(
  body: GatewayMediaAssetUploadRequest,
): GatewayMediaAssetUploadRequest {
  const kind = normalizeMediaKind(body.kind);
  const input = optionalText(body.input);
  const dataBase64 = optionalText(body.dataBase64);
  const url = optionalText(body.url);
  const {
    contentType,
    dataBase64: _dataBase64,
    filename,
    input: _input,
    url: _url,
    ...rest
  } = body;
  if (!input && !dataBase64 && !url) {
    throw new Error("gateway media: missing media asset source");
  }
  return {
    ...rest,
    kind,
    ...(input ? { input } : {}),
    ...(dataBase64 ? { dataBase64 } : {}),
    ...(url ? { url } : {}),
    ...(filename !== undefined
      ? { filename: requiredText(filename, "media asset filename") }
      : {}),
    ...(contentType !== undefined
      ? { contentType: requiredText(contentType, "media asset content type") }
      : {}),
  };
}

export class GatewayMediaApiClient
  extends BaseHttpApiClient
  implements GatewayMediaClient
{
  readonly endpoints: GatewayMediaEndpointMap;

  constructor(
    options: HttpApiClientOptions,
    mediaOptions: GatewayMediaApiClientOptions = {},
  ) {
    super(mediaOptions.surface ?? "gateway-media-api", options);
    this.endpoints = mediaOptions.endpoints ?? GATEWAY_MEDIA_API_ENDPOINTS;
  }

  listMediaProviders(
    kind?: GatewayMediaKind | null,
  ): Promise<GatewayMediaProviderList> {
    return this.requestJson<GatewayMediaProviderList>(
      this.endpoints.providers(kind ? normalizeMediaKind(kind) : null),
    );
  }

  generateMedia(
    body: GatewayMediaGenerateRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    const kind = normalizeMediaKind(body.kind);
    return this.requestJson<GatewayMediaGenerationResult>(this.endpoints.generate(kind), {
      method: "POST",
      body: {
        ...body,
        kind,
        input: requiredText(body.input, "media input"),
      },
      idempotencyKey,
    });
  }

  generateAudio(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.generateMedia({ ...body, kind: "audio" }, idempotencyKey);
  }

  generateImage(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.generateMedia({ ...body, kind: "image" }, idempotencyKey);
  }

  generateVideo(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.generateMedia({ ...body, kind: "video" }, idempotencyKey);
  }

  generateMusic(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.generateMedia({ ...body, kind: "music" }, idempotencyKey);
  }

  generateTextToSpeech(
    body: GatewayTextToSpeechRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult> {
    const { text, ...mediaBody } = body;
    return this.generateAudio(
      {
        ...mediaBody,
        input: requiredText(text, "text-to-speech text"),
      },
      idempotencyKey,
    );
  }

  getMediaJob(
    kind: GatewayMediaKind,
    jobId: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.requestJson<GatewayMediaGenerationResult>(
      this.endpoints.job(normalizeMediaKind(kind), requiredText(jobId, "media job id")),
    );
  }

  waitForMediaJob(
    kind: GatewayMediaKind,
    jobId: string,
    options: GatewayMediaJobWaitOptions = {},
  ): Promise<GatewayMediaGenerationResult> {
    return waitForGatewayJob({
      ...options,
      fetchJob: () => this.getMediaJob(kind, jobId),
    });
  }

  listMediaAssets(
    options: GatewayMediaAssetListOptions = {},
  ): Promise<GatewayMediaAssetList> {
    return this.requestJson<GatewayMediaAssetList>(
      this.endpoints.assets(normalizeListOptions(options)),
    );
  }

  getMediaAssetMetadata(assetId: string): Promise<GatewayMediaAsset> {
    return this.requestJson<GatewayMediaAsset>(
      this.endpoints.asset(requiredText(assetId, "media asset id")),
      {
        headers: { Accept: "application/json" },
      },
    );
  }

  createMediaAsset(
    body: GatewayMediaAssetUploadRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaAsset> {
    const normalized = normalizeAssetUploadRequest(body);
    return this.requestJson<GatewayMediaAsset>(
      this.endpoints.assets({ kind: normalized.kind }),
      {
        method: "POST",
        body: normalized,
        idempotencyKey,
      },
    );
  }

  uploadMediaAsset(
    body: GatewayMediaAssetUploadRequest,
    idempotencyKey?: string,
  ): Promise<GatewayMediaAsset> {
    return this.createMediaAsset(body, idempotencyKey);
  }

  deleteMediaAsset(assetId: string): Promise<GatewayMediaAssetDeleteResult> {
    return this.requestJson<GatewayMediaAssetDeleteResult>(
      this.endpoints.asset(requiredText(assetId, "media asset id")),
      { method: "DELETE" },
    );
  }

  getMediaAsset(assetId: string, init: GatewayMediaAssetRequest = {}): Promise<Blob> {
    return this.requestBlob(this.endpoints.asset(requiredText(assetId, "media asset id")), {
      ...init,
      headers: {
        Accept: init.accept ?? "application/octet-stream",
        ...(init.headers ?? {}),
      },
    });
  }

  getAudioAsset(assetId: string, init: GatewayMediaAssetRequest = {}): Promise<Blob> {
    return this.getMediaAsset(assetId, {
      ...init,
      accept: init.accept ?? GATEWAY_MEDIA_ACCEPT_HEADERS.audio,
    });
  }

  getImageAsset(assetId: string, init: GatewayMediaAssetRequest = {}): Promise<Blob> {
    return this.getMediaAsset(assetId, {
      ...init,
      accept: init.accept ?? GATEWAY_MEDIA_ACCEPT_HEADERS.image,
    });
  }

  getVideoAsset(assetId: string, init: GatewayMediaAssetRequest = {}): Promise<Blob> {
    return this.getMediaAsset(assetId, {
      ...init,
      accept: init.accept ?? GATEWAY_MEDIA_ACCEPT_HEADERS.video,
    });
  }

  getMusicAsset(assetId: string, init: GatewayMediaAssetRequest = {}): Promise<Blob> {
    return this.getMediaAsset(assetId, {
      ...init,
      accept: init.accept ?? GATEWAY_MEDIA_ACCEPT_HEADERS.music,
    });
  }
}

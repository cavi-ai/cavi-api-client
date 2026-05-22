import { GATEWAY_MEDIA_API_ENDPOINTS } from "../../../contracts/paths.js";
import { BaseHttpApiClient } from "../../http/client.js";
import type { HttpApiClientOptions, HttpApiRequestInit } from "../../http/types.js";

export const GATEWAY_MEDIA_KINDS = ["audio", "video", "music"] as const;

export type GatewayMediaKind = (typeof GATEWAY_MEDIA_KINDS)[number];

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
  generateVideo(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  generateMusic(
    body: GatewayMediaGenerateInput,
    idempotencyKey?: string,
  ): Promise<GatewayMediaGenerationResult>;
  getMediaJob(
    kind: GatewayMediaKind,
    jobId: string,
  ): Promise<GatewayMediaGenerationResult>;
  getMediaAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
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

  getMediaJob(
    kind: GatewayMediaKind,
    jobId: string,
  ): Promise<GatewayMediaGenerationResult> {
    return this.requestJson<GatewayMediaGenerationResult>(
      this.endpoints.job(normalizeMediaKind(kind), requiredText(jobId, "media job id")),
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
}

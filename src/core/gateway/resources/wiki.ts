import { GATEWAY_WIKI_API_ENDPOINTS } from "../../../contracts/paths.js";
import { BaseHttpApiClient } from "../../http/client.js";
import type { HttpApiClientOptions, HttpApiRequestInit } from "../../http/types.js";

export const GATEWAY_WIKI_FORMATS = [
  "qmd",
  "markdown",
  "html",
  "pdf",
  "text",
  "json",
] as const;

export type GatewayWikiFormat = (typeof GATEWAY_WIKI_FORMATS)[number];

export type GatewayWikiJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly GatewayWikiJsonValue[]
  | { readonly [key: string]: GatewayWikiJsonValue };

export type GatewayWikiEndpointMap = {
  vaults: string;
  vault: (vaultId: string) => string;
  tree: (vaultId: string) => string;
  read: (vaultId: string, path: string) => string;
  ingest: (vaultId: string) => string;
  compile: (vaultId: string) => string;
  promote: (vaultId: string) => string;
  job: (vaultId: string, jobId: string) => string;
  artifact: (vaultId: string, artifactId: string) => string;
};

export type GatewayWikiVault = {
  id: string;
  label?: string;
  pluginId?: string;
  rootPath?: string;
  defaultFormat?: GatewayWikiFormat | string;
  capabilities?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type GatewayWikiVaultList = {
  object?: string;
  vaults: readonly GatewayWikiVault[];
};

export type GatewayWikiTreeEntry = {
  path: string;
  kind: "directory" | "file" | string;
  title?: string;
  format?: GatewayWikiFormat | string;
  size?: number;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayWikiTree = {
  object?: string;
  vaultId: string;
  entries: readonly GatewayWikiTreeEntry[];
  metadata?: Record<string, unknown>;
};

export type GatewayWikiPage = {
  object?: string;
  vaultId: string;
  path: string;
  title?: string;
  format?: GatewayWikiFormat | string;
  content: string;
  frontmatter?: Record<string, GatewayWikiJsonValue>;
  metadata?: Record<string, unknown>;
};

export type GatewayWikiIngestRequest = {
  path?: string;
  title?: string;
  content?: string;
  sourceUrl?: string;
  sourcePath?: string;
  artifactId?: string;
  format?: GatewayWikiFormat | string;
  tags?: readonly string[];
  frontmatter?: Record<string, GatewayWikiJsonValue>;
  teamId?: string;
  memberId?: string;
  actionId?: string;
  options?: Record<string, GatewayWikiJsonValue>;
  metadata?: Record<string, unknown>;
};

export type GatewayWikiCompileRequest = {
  path?: string;
  paths?: readonly string[];
  target?: GatewayWikiFormat | string;
  outputPath?: string;
  options?: Record<string, GatewayWikiJsonValue>;
  metadata?: Record<string, unknown>;
};

export type GatewayWikiPromoteRequest = {
  sourcePath?: string;
  targetPath?: string;
  artifactId?: string;
  title?: string;
  status?: string;
  tags?: readonly string[];
  frontmatter?: Record<string, GatewayWikiJsonValue>;
  options?: Record<string, GatewayWikiJsonValue>;
  metadata?: Record<string, unknown>;
};

export type GatewayWikiJobResult = {
  object?: string;
  id?: string;
  jobId?: string;
  vaultId?: string;
  path?: string;
  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | string;
  artifactId?: string;
  outputPath?: string;
  page?: GatewayWikiPage;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayWikiArtifactRequest = Pick<
  HttpApiRequestInit,
  "cache" | "credentials" | "headers" | "signal" | "timeoutMs"
> & {
  accept?: string;
};

export type GatewayWikiApiClientOptions = {
  endpoints?: GatewayWikiEndpointMap;
  surface?: string;
};

export interface GatewayWikiClient {
  listWikiVaults(): Promise<GatewayWikiVaultList>;
  getWikiVault(vaultId: string): Promise<GatewayWikiVault>;
  getWikiTree(vaultId: string): Promise<GatewayWikiTree>;
  readWikiPage(vaultId: string, path: string): Promise<GatewayWikiPage>;
  ingestWiki(
    vaultId: string,
    body: GatewayWikiIngestRequest,
    idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult>;
  compileWiki(
    vaultId: string,
    body: GatewayWikiCompileRequest,
    idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult>;
  promoteWiki(
    vaultId: string,
    body: GatewayWikiPromoteRequest,
    idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult>;
  getWikiJob(vaultId: string, jobId: string): Promise<GatewayWikiJobResult>;
  getWikiArtifact(
    vaultId: string,
    artifactId: string,
    init?: GatewayWikiArtifactRequest,
  ): Promise<Blob>;
}

function requiredText(value: string | null | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`gateway wiki: missing ${label}`);
  }
  return normalized;
}

function normalizeVaultId(vaultId: string): string {
  return requiredText(vaultId, "wiki vault id");
}

export class GatewayWikiApiClient
  extends BaseHttpApiClient
  implements GatewayWikiClient
{
  readonly endpoints: GatewayWikiEndpointMap;

  constructor(
    options: HttpApiClientOptions,
    wikiOptions: GatewayWikiApiClientOptions = {},
  ) {
    super(wikiOptions.surface ?? "gateway-wiki-api", options);
    this.endpoints = wikiOptions.endpoints ?? GATEWAY_WIKI_API_ENDPOINTS;
  }

  listWikiVaults(): Promise<GatewayWikiVaultList> {
    return this.requestJson<GatewayWikiVaultList>(this.endpoints.vaults);
  }

  getWikiVault(vaultId: string): Promise<GatewayWikiVault> {
    return this.requestJson<GatewayWikiVault>(
      this.endpoints.vault(normalizeVaultId(vaultId)),
    );
  }

  getWikiTree(vaultId: string): Promise<GatewayWikiTree> {
    return this.requestJson<GatewayWikiTree>(
      this.endpoints.tree(normalizeVaultId(vaultId)),
    );
  }

  readWikiPage(vaultId: string, path: string): Promise<GatewayWikiPage> {
    return this.requestJson<GatewayWikiPage>(
      this.endpoints.read(
        normalizeVaultId(vaultId),
        requiredText(path, "wiki page path"),
      ),
    );
  }

  ingestWiki(
    vaultId: string,
    body: GatewayWikiIngestRequest,
    idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult> {
    return this.requestJson<GatewayWikiJobResult>(
      this.endpoints.ingest(normalizeVaultId(vaultId)),
      {
        method: "POST",
        body,
        idempotencyKey,
      },
    );
  }

  compileWiki(
    vaultId: string,
    body: GatewayWikiCompileRequest,
    idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult> {
    return this.requestJson<GatewayWikiJobResult>(
      this.endpoints.compile(normalizeVaultId(vaultId)),
      {
        method: "POST",
        body,
        idempotencyKey,
      },
    );
  }

  promoteWiki(
    vaultId: string,
    body: GatewayWikiPromoteRequest,
    idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult> {
    return this.requestJson<GatewayWikiJobResult>(
      this.endpoints.promote(normalizeVaultId(vaultId)),
      {
        method: "POST",
        body,
        idempotencyKey,
      },
    );
  }

  getWikiJob(vaultId: string, jobId: string): Promise<GatewayWikiJobResult> {
    return this.requestJson<GatewayWikiJobResult>(
      this.endpoints.job(
        normalizeVaultId(vaultId),
        requiredText(jobId, "wiki job id"),
      ),
    );
  }

  getWikiArtifact(
    vaultId: string,
    artifactId: string,
    init: GatewayWikiArtifactRequest = {},
  ): Promise<Blob> {
    return this.requestBlob(
      this.endpoints.artifact(
        normalizeVaultId(vaultId),
        requiredText(artifactId, "wiki artifact id"),
      ),
      {
        ...init,
        headers: {
          Accept: init.accept ?? "application/octet-stream",
          ...(init.headers ?? {}),
        },
      },
    );
  }
}

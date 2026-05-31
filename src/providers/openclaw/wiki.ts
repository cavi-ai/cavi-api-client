// OpenClaw wiki dispatcher. OpenClaw core does not expose a wiki RPC namespace
// (see `docs/providers/openclaw/api-endpoints.md`). Every method on this
// dispatcher throws `ApiClientError(EndpointNotFound)` until an OpenClaw plugin
// manifest registers wiki routes — at which point the
// `withCaviControlWikiRoutes`-style enrichment (plan §5) layers them on.
//
// The dispatcher exists at all so `createGatewayWikiClient(opts, {provider:
// "openclaw"})` returns a typed `GatewayWikiClient` whose methods fail loudly
// and clearly rather than silently hitting a REST surface OpenClaw doesn't
// serve.

import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../../core/errors.js";
import { GatewayWikiApiClient } from "../../core/gateway/resources/wiki.js";
import type {
  GatewayWikiArtifactRequest,
  GatewayWikiCompileRequest,
  GatewayWikiIngestRequest,
  GatewayWikiJobResult,
  GatewayWikiPage,
  GatewayWikiPromoteRequest,
  GatewayWikiTree,
  GatewayWikiVault,
  GatewayWikiVaultList,
} from "../../core/gateway/resources/wiki.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

function gated(method: string): never {
  throw new ApiClientError(
    `openclaw: ${method} is not part of the core OpenClaw surface. Install an OpenClaw plugin that registers wiki routes.`,
    {
      type: ApiClientErrorType.Http,
      code: ApiClientErrorCode.EndpointNotFound,
    },
  );
}

export class OpenClawWikiApiClient extends GatewayWikiApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, { surface: "openclaw-wiki-api" });
  }

  override async listWikiVaults(): Promise<GatewayWikiVaultList> {
    return gated("listWikiVaults");
  }

  override async getWikiVault(_vaultId: string): Promise<GatewayWikiVault> {
    return gated("getWikiVault");
  }

  override async getWikiTree(_vaultId: string): Promise<GatewayWikiTree> {
    return gated("getWikiTree");
  }

  override async readWikiPage(_vaultId: string, _path: string): Promise<GatewayWikiPage> {
    return gated("readWikiPage");
  }

  override async ingestWiki(
    _vaultId: string,
    _body: GatewayWikiIngestRequest,
    _idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult> {
    return gated("ingestWiki");
  }

  override async compileWiki(
    _vaultId: string,
    _body: GatewayWikiCompileRequest,
    _idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult> {
    return gated("compileWiki");
  }

  override async promoteWiki(
    _vaultId: string,
    _body: GatewayWikiPromoteRequest,
    _idempotencyKey?: string,
  ): Promise<GatewayWikiJobResult> {
    return gated("promoteWiki");
  }

  override async getWikiJob(_vaultId: string, _jobId: string): Promise<GatewayWikiJobResult> {
    return gated("getWikiJob");
  }

  override async getWikiArtifact(
    _vaultId: string,
    _artifactId: string,
    _init?: GatewayWikiArtifactRequest,
  ): Promise<Blob> {
    return gated("getWikiArtifact");
  }
}

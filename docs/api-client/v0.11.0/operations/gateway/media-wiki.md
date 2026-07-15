---
documentedVersion: 0.11.0
---

# Gateway media & wiki operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Gateway media (`GATEWAY_MEDIA_API_ENDPOINTS`, base `/v1/media`) and wiki
(`GATEWAY_WIKI_API_ENDPOINTS`, base `/v1/wiki`) surfaces. Both maps are aliased
for Hermes and OpenClaw, but note OpenClaw does not serve `/v1/media/*` or
`/v1/wiki/*` — those are Hermes/gateway surfaces. Media asset and wiki-vault
routes interpolate an id into the base path, so their `**HTTP**` lines name the
owner helper and the concrete path is given in the description. Path literals are
owned by `src/contracts/paths.ts`.

## media.root

**HTTP** `GET /v1/media`
**Capability** gateway

Gateway media API root.

## mediaProviders

**HTTP** `GET /v1/media/:kind/providers`
**Capability** gateway (`hard` — required for core compat)

Provider inventory across audio, image, video, and music generation. Omit
`:kind` for the cross-kind inventory (path `/v1/media/providers`); supply a kind
to scope the inventory to a single media kind.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| kind | string | no | Path param — `audio` \| `image` \| `video` \| `music`. Omit for all kinds. |

## mediaGenerate

**HTTP** `POST /v1/media/:kind/generate`
**Capability** gateway (`hard` — required for core compat)

Media generation route. One handler per kind, keyed in the endpoint map as
`gateway.mediaAudioGenerate` (path `/v1/media/audio/generate`),
`gateway.mediaImageGenerate` (path `/v1/media/image/generate`),
`gateway.mediaVideoGenerate` (path `/v1/media/video/generate`), and
`gateway.mediaMusicGenerate` (path `/v1/media/music/generate`).

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| kind | string | yes | Path param — `audio` \| `image` \| `video` \| `music`. |

## mediaJob

**HTTP** `GET /v1/media/:kind/jobs/:jobId`
**Capability** gateway (`hard` — required for core compat)

Media job status route.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| kind | string | yes | Path param — media kind. |
| jobId | string | yes | Path param — media job id. |

## mediaAssets

**HTTP** `GET` `GATEWAY_MEDIA_API_ENDPOINTS.assets({ kind, cursor, limit })`
**Capability** gateway (`hard` — required for core compat)

Media asset inventory route. Path `/v1/media/assets?kind=:kind&cursor=:cursor&limit=:limit`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| kind | string | no | Query param — filter by media kind. |
| cursor | string | no | Query param — pagination cursor. |
| limit | number | no | Query param — page size. |

## mediaAssetCreate

**HTTP** `POST` `GATEWAY_MEDIA_API_ENDPOINTS.assets({ kind })`
**Capability** gateway (`hard` — required for core compat)

Create or upload a media asset. Path `/v1/media/assets?kind=:kind`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| kind | string | no | Query param — media kind of the new asset. |

## mediaAsset

**HTTP** `GET` `GATEWAY_MEDIA_API_ENDPOINTS.asset(assetId)`
**Capability** gateway (`hard` — required for core compat)

Fetch media asset bytes or metadata, depending on the `Accept` header. Path
`/v1/media/assets/:assetId`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| assetId | string | yes | Path param — media asset id. |

## mediaAssetDelete

**HTTP** `DELETE` `GATEWAY_MEDIA_API_ENDPOINTS.asset(assetId)`
**Capability** gateway (`hard` — required for core compat)

Delete a media asset. Path `/v1/media/assets/:assetId`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| assetId | string | yes | Path param — media asset id. |

## wiki.root

**HTTP** `GET /v1/wiki`
**Capability** gateway

Gateway wiki API root.

## wikiVaults

**HTTP** `GET` `GATEWAY_WIKI_API_ENDPOINTS.vaults`
**Capability** gateway (`hard` — required for core compat)

Vault inventory for external Obsidian/QMD plugin vaults. Path `/v1/wiki/vaults`.

## wiki.vault

**HTTP** `GET` `GATEWAY_WIKI_API_ENDPOINTS.vault(vaultId)`
**Capability** gateway

Vault metadata. Path `/v1/wiki/vaults/:vaultId`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |

## wikiTree

**HTTP** `GET` `GATEWAY_WIKI_API_ENDPOINTS.tree(vaultId)`
**Capability** gateway (`hard` — required for core compat)

Vault tree route. Path `/v1/wiki/vaults/:vaultId/tree`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |

## wikiRead

**HTTP** `GET` `GATEWAY_WIKI_API_ENDPOINTS.read(vaultId, path)`
**Capability** gateway (`hard` — required for core compat)

Read a wiki page or file. Path `/v1/wiki/vaults/:vaultId/read?path=:path`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |
| path | string | yes | Query param — file path within the vault. |

## wikiIngest

**HTTP** `POST` `GATEWAY_WIKI_API_ENDPOINTS.ingest(vaultId)`
**Capability** gateway (`hard` — required for core compat)

Ingest content into a wiki vault. Path `/v1/wiki/vaults/:vaultId/ingest`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |

## wikiCompile

**HTTP** `POST` `GATEWAY_WIKI_API_ENDPOINTS.compile(vaultId)`
**Capability** gateway (`hard` — required for core compat)

Compile QMD/wiki content. Path `/v1/wiki/vaults/:vaultId/compile`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |

## wikiPromote

**HTTP** `POST` `GATEWAY_WIKI_API_ENDPOINTS.promote(vaultId)`
**Capability** gateway (`hard` — required for core compat)

Promote wiki output for durable publishing. Path `/v1/wiki/vaults/:vaultId/promote`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |

## wiki.job

**HTTP** `GET` `GATEWAY_WIKI_API_ENDPOINTS.job(vaultId, jobId)`
**Capability** gateway

Wiki job status. Path `/v1/wiki/vaults/:vaultId/jobs/:jobId`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |
| jobId | string | yes | Path param — wiki job id. |

## wiki.artifact

**HTTP** `GET` `GATEWAY_WIKI_API_ENDPOINTS.artifact(vaultId, artifactId)`
**Capability** gateway

Wiki artifact retrieval. Path `/v1/wiki/vaults/:vaultId/artifacts/:artifactId`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| vaultId | string | yes | Path param — wiki vault id. |
| artifactId | string | yes | Path param — wiki artifact id. |

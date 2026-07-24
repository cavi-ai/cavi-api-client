---
documentedVersion: 0.14.0
---

# Library operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

The library folder is the client for the CAVI **library** plugin — document
ingest, search, retrieval, and the CaviClip capture pipeline. These are
plugin-specific REST surfaces (`/library/api/*` and the `/api/plugins/library/*`
surface contracts); there is no native gateway RPC that provides document
ingest/search, so none of these are redundant with an upstream capability. The
thin CRUD wrappers add typing and route-owner resolution; the clip helpers add
real payload construction and diagnostics.

Route owners: `LIBRARY_API_ENDPOINTS` + `resolveLibraryApiPath` in
`extensions/cavi/contracts/paths.ts`,
and the `library.*` surface keys in
`surfaces.ts`.

Source: `extensions/cavi/library/`.

## Client CRUD

### LibraryApiClient.ingest

**Signature** `client.ingest(body: LibraryIngestRequest, idempotencyKey?: string): Promise<LibraryIngestResult>`
**HTTP** `POST` `resolveLibraryApiPath("ingest")`
**Capability** n/a
**Upstream equivalent** none (library plugin ingest endpoint)
**CAVI value-add** Typed ingest request/result over `BaseHttpApiClient` with idempotency-key support; no native gateway document-ingest capability exists to supersede it.

#### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| source | `LibraryIngestSource` | yes | `url` / `text` / `file` / `note` payload. |
| workspaceId | `string` | no | Target workspace. |
| channelId | `string` | no | Source channel. |
| threadId | `string` | no | Source thread. |
| requestedBy | `string` | no | Operator id. |

### LibraryApiClient.search

**Signature** `client.search<T>(query: Record<string, string | number | boolean | undefined>): Promise<T>`
**HTTP** `GET` `resolveLibraryApiPath("search")` (query appended)
**Capability** n/a
**Upstream equivalent** none (library plugin search endpoint)
**CAVI value-add** Query-string assembly (`appendHttpQuery`) over the typed client; library search is a plugin capability with no gateway-native counterpart.

### LibraryApiClient.getDocument

**Signature** `client.getDocument<T>(id: string): Promise<T>`
**HTTP** `GET` `resolveLibraryApiPath("documents/:id")`
**Capability** n/a
**Upstream equivalent** none (library plugin document endpoint)
**CAVI value-add** Path-encoded document retrieval via the route owner; no upstream equivalent.

## CaviClip

### postLibraryClip

**Signature** `postLibraryClip<T>(requestJson: LibraryClipTransport, input: LibraryClipInput, opts?: { timeoutMs?: number }): Promise<T>`
**HTTP** `POST` `resolveCaviPath("library.clip")`
**Capability** n/a
**Upstream equivalent** none (library CaviClip ingest endpoint)
**CAVI value-add** Builds the `LIBRARY_CLIP_V1` payload — derives a title from the URL/text, de-duplicates tags (always including the `caviclip` source tag), defaults the team, and stamps ingress metadata — then POSTs through the surface contract rather than a hardcoded route.

#### Example

```ts
await postLibraryClip(requestJson, {
  sourceUrl: "https://example.com/post",
  tags: ["research"],
});
```

### requestLibraryClipDiagnostics

**Signature** `requestLibraryClipDiagnostics(requestJson: LibraryClipTransport): Promise<LibraryClipDiagnosticsSnapshot>`
**HTTP** `GET` `resolveLibraryApiPath("status")` + `LIBRARY_CLIP_HEALTH_ENDPOINT` + `LIBRARY_CLIP_SCHEMA_ENDPOINT` + `LIBRARY_CLIP_LOGS_ENDPOINT`
**Capability** n/a
**Upstream equivalent** none
**CAVI value-add** Probes the clip pipeline (status/health/schema/logs) in parallel, tolerates individual endpoint failures, and returns an aggregate diagnostics snapshot — falling back to the locally-built `LIBRARY_CLIP_V1` schema when the gateway does not serve one.

### buildLibraryClipPayload / buildLibraryClipSchemaSnapshot / buildLibraryManualFileClipInput

**Signature** `buildLibraryClipPayload(input: LibraryClipInput): LibraryClipRequest` (and siblings)
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** none
**CAVI value-add** Pure client-side payload/schema construction for CaviClip (title inference, tag dedup, manual-file smoke text). No upstream equivalent — these are the CAVI capture contract.

## Low-level transport

`fetchLibraryApiJson` and `requestLibraryApiJson` are library-scoped HTTP
transports (`GET`/mutation over `resolveLibraryApiPath`) used by the helpers
above. They add library-specific auth-header assembly, session-auth-mode
handling, and error-body extraction on top of the raw HTTP client — CAVI
value-add over `BaseHttpApiClient`, not a duplicated gateway capability.

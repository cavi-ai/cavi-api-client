---
documentedVersion: 0.16.0
---

# Portal operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

The portal folder is the client for per-agent CAVI **portal** plugins: a
dashboard aggregate, a generic `/api/plugins/portal/{portal}/…` dispatcher, a
portal-memory snapshot read, and a text-to-speech surface. Portal TTS routes are
**agent-specific and supplied by the caller** (resolved from the team manifest);
the package binds no concrete agent's TTS routes. Two of the TTS helpers overlap
with the core gateway media client and are flagged **Needs decision** below.

Route owners: `resolvePortalApiPath`, `CAVI_CONTROL_API_ENDPOINTS.portalMemorySnapshot`
in `extensions/cavi/contracts/paths.ts`;
surface keys `portal.dashboard` / `portal.config` / `portalMemory.snapshot` in
`surfaces.ts`.

Source: `extensions/cavi/portal/`.

## PortalApiClient.getDashboard

**Signature** `client.getDashboard<T>(): Promise<T>`
**HTTP** `GET` `resolveCaviPath("portal.dashboard", { portal })`
**Capability** n/a
**Upstream equivalent** none (portal plugin dashboard aggregate)
**CAVI value-add** Binds the client's `portalId` into the portal dashboard route and returns the aggregate; the aggregate is a portal-plugin capability with no gateway-native equivalent.

### PortalApiClient.getFromPortal / postToPortal

**Signature** `client.getFromPortal<T>(relativePath)`, `client.postToPortal<T>(relativePath, body, idempotencyKey?)`
**HTTP** `GET`/`POST` `resolvePortalApiPath(portalId, relativePath)`
**Capability** n/a
**Upstream equivalent** none (generic portal-plugin dispatcher)
**CAVI value-add** Safe path composition (`appendCaviApiPath` boundary checks) for the generic per-portal dispatcher — traversal-guarded relative routing no upstream surface provides.

### PortalApiClient.getPortalMemorySnapshot

> Needs decision — value-add unclear. See
> [Removal Candidates](../removal-candidates.md).

**Signature** `client.getPortalMemorySnapshot<T>(teamSlug, memberId, memoryKey): Promise<T>`
**HTTP** `GET` `CAVI_CONTROL_API_ENDPOINTS.portalMemorySnapshot(teamSlug, memberId, memoryKey)`
**Capability** n/a
**Upstream equivalent** unclear — possibly the core `MemoryStore.recall` contract (`core/memory`) or a native runtime memory read
**CAVI value-add** unclear — verify. It is a typed pass-through GET to the portal-memory plugin route; whether that plugin read should route through the universal `MemoryStore` contract instead of a portal-specific endpoint is an open question.

## Text-to-speech

### requestPortalTtsProviders

> Needs decision — value-add unclear. See
> [Removal Candidates](../removal-candidates.md).

**Signature** `requestPortalTtsProviders(requestJson: PortalTtsJsonRequester, providersPath: string): Promise<unknown>`
**HTTP** `GET` `<caller-supplied providersPath>`
**Capability** n/a
**Upstream equivalent** core `GatewayMediaClient.listMediaProviders()` (`core/gateway/resources/media.ts`)
**CAVI value-add** unclear — verify. This is an identity pass-through (`requestJson(providersPath)`) against a manifest-supplied per-agent path. Core gateway media already lists providers/voices; the open question is whether per-agent portal TTS is a genuine divergence or should unify onto the media client.

### requestPortalTtsAudio

> Needs decision — value-add unclear. See
> [Removal Candidates](../removal-candidates.md).

**Signature** `requestPortalTtsAudio(transport: PortalTtsAudioTransport, ttsPath: string, body: PortalTtsAudioRequest): Promise<Blob>`
**HTTP** `POST` `<caller-supplied ttsPath>` (returns audio Blob)
**Capability** n/a
**Upstream equivalent** core `GatewayMediaClient.generateTextToSpeech()` (`core/gateway/resources/media.ts`)
**CAVI value-add** unclear — verify. Adds text validation and `Accept` negotiation, then POSTs to a caller-supplied per-agent TTS path. Core gateway media already synthesizes speech to a Blob; whether the portal path warrants a separate helper is the open question.

#### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| text | `string` | yes | Text to synthesize (empty throws). |
| voiceId | `string \| null` | no | Provider voice id. |
| providerId | `string \| null` | no | TTS provider id. |
| format | `string \| null` | no | Audio format hint. |
| accept | `string \| null` | no | Accept header; defaults `audio/mpeg`. |
| options | `Record<string, GatewayMediaJsonValue>` | no | Provider-specific options. |

### buildPortalTtsVoiceOptions / createPortalTtsAgentVoiceAssignment / getPortalTtsProviderLabel

**Signature** `buildPortalTtsVoiceOptions(params): PortalTtsVoiceOption[]` (and siblings)
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** none (UI-facing aggregation)
**CAVI value-add** Merges gateway provider voices with dashboard voice fallbacks into a deduplicated, active-first option list, and builds agent voice assignments. Core media exposes raw provider/voice data only; this UI aggregation has no upstream counterpart — kept.

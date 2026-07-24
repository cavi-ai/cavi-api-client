---
documentedVersion: 0.14.0
---

# Removal candidates

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Operations flagged during the operation-reference audit as redundant with an
upstream equivalent, with no CAVI-specific value-add. This appendix is the input
to a separate, per-item-approved removal branch — **no code is removed by the
docs change**.

## Summary

The honest finding: **no CAVI-extension operation is a confirmed pure
pass-through of an upstream capability.** The surfaces that most resemble native
gateway capability — the Project Board kanban helpers and the Discourse loader —
are the package's intended **divergence points**: they prefer native RPC
(OpenClaw Workboard `workboard.cards.*`, gateway `discourse.tree`) and add a
REST/compat fallback ladder, DTO normalization, and degrade-to-mock. That
fallback *is* the value, so they are kept.

Three portal helpers overlap with an upstream capability enough to warrant a
decision but not enough to declare dead — they target caller-supplied per-agent
paths rather than the native endpoint, so the redundancy is genuinely unclear.
They are listed under Needs decision, not Redundant.

## Redundant (recommend removal)

| Operation | Page | Upstream equivalent | Rationale |
| --------- | ---- | ------------------- | --------- |
| none found | — | — | No confirmed pure pass-through with a concrete upstream equivalent. |

## Needs decision (value-add unclear)

| Operation | Page | Upstream equivalent | Open question |
| --------- | ---- | ------------------- | ------------- |
| `requestPortalTtsProviders` | operations/cavi/portal.md | core `GatewayMediaClient.listMediaProviders()` (`core/gateway/resources/media.ts`) | Identity pass-through (`requestJson(providersPath)`) against a manifest-supplied per-agent path. Core media already lists providers/voices. Is per-agent portal TTS a real divergence, or should it unify onto the media client? |
| `requestPortalTtsAudio` | operations/cavi/portal.md | core `GatewayMediaClient.generateTextToSpeech()` (`core/gateway/resources/media.ts`) | Adds text validation + `Accept` negotiation, then POSTs a Blob to a caller-supplied per-agent TTS path. Core media already synthesizes speech to a Blob. Does the portal path justify a separate helper? |
| `PortalApiClient.getPortalMemorySnapshot` | operations/cavi/portal.md | possibly core `MemoryStore.recall` (`core/memory`) or a native runtime memory read | Typed pass-through GET to the portal-memory plugin route. Should portal member-memory reads route through the universal `MemoryStore` contract instead of a portal-specific endpoint? |

# Changelog

All notable changes to `@cavi-ai/api-client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> `0.1.x` were unpublished pre-release iterations. `0.2.0` is the first tracked
> public release; the history below starts here.

## [Unreleased]

### Added

- Provider-agnostic manifest schema at
  `src/core/gateway/providers/manifest.types.ts`. Each provider declares its
  RPC methods, REST endpoints, and events in one place; the api-client derives
  method tables and capabilities from that single source. Hermes drops in next
  using the same shape.
- OpenClaw manifest at `src/providers/openclaw/manifest.ts` mirroring the
  vendored gateway doc 1:1 (all advertised + unadvertised core RPC methods,
  HTTP families, scopes, and `docSection` anchors). All entries marked
  `status: "doc-only"` until verified via Postman / live gateway.
- Derived `OPENCLAW_RPC_METHODS`, `OPENCLAW_CORE_RPC_METHODS`, and
  `OPENCLAW_DEFAULT_CAPABILITIES` now live in
  `src/providers/openclaw/manifest.derive.ts` — single source of truth, no
  parallel string tables.
- Conformance test `src/__tests__/providers/openclaw/manifest.test.ts` fails
  the build on drift between the manifest, the derived constants, the
  dispatcher classes, and the vendored gateway doc.

### Changed

- Unified capability dispatch: provider modules now route the UI's single
  capability calls (`generateImage`, `generateAudio`, `listMediaProviders`,
  …) to each gateway's native surface. `GatewayMediaApiClient` remains the
  REST `/v1/media/*` reference implementation (Hermes); `OpenClawMediaApiClient`
  dispatches `tts.providers` / `tts.convert` RPC for audio and throws a typed
  `EndpointNotFound` for image / video / music until an OpenClaw plugin
  manifest registers routes.
- `OpenClawWikiApiClient` and `OpenClawAgentConfigApiClient` follow the same
  gated-dispatcher pattern: every method throws `ApiClientError` with
  `code: ApiClientErrorCode.EndpointNotFound` until verified against the live
  gateway (or a plugin manifest registers routes).

### Removed

- `OPENCLAW_MEDIA_API_ENDPOINTS`, `OPENCLAW_WIKI_API_ENDPOINTS`, and
  `OPENCLAW_AGENT_CONFIG_API_ENDPOINTS` aliases in `contracts/paths.ts` —
  those `/v1/media/*` and `/v1/wiki/*` REST paths do not exist on OpenClaw
  (its `/v1/*` surface is OpenAI-compat only).

## [0.2.0] - 2026-05-28

First public release of `@cavi-ai/api-client` as a standalone, gateway-agnostic
client for agent runtimes.

### Added

- Gateway-agnostic HTTP (`BaseHttpApiClient`, `CaviControlApiClient`), WebSocket
  RPC (`GatewayRpcClient`), SSE run-event streams, and run/media/wiki clients.
- `GatewayApiClient` with a provider-module registry for built-in and
  host-supplied gateways (Hermes, OpenClaw, or your own).
- Typed error surface — `HttpApiError`, `GatewayHttpError`, `GatewayRpcError`,
  `ApiClientError` — with guards `isHttpApiError`, `isGatewayHttpError`,
  `isAuthError`, `isAbortError`, and `getErrorStatus`.
- Structured graceful degradation via `DataEnvelope`, `withFallback`, and
  `withMutationResult`.
- Owned path and surface contracts (`resolvePath`, `resolveCaviPath`) plus a
  runtime-supplied team manifest with normalization, lookup validation,
  workspace-path whitelisting, and route bindings.
- Optional React bindings at `@cavi-ai/api-client/frameworks/react`; UI-framework
  bindings live as siblings under `frameworks/**`.
- CAVI extension adapters for product-shaped dashboards and fallback providers.
- Strict package-boundary hardening tests, ESM-only build, and subpath exports.
- Public release docs, including contributing, security, architecture, code of
  conduct, issue templates, CI, and trusted npm publishing workflow.

[Unreleased]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/cavi-ai/cavi-api-client/releases/tag/v0.2.0

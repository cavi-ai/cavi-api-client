# Changelog

All notable changes to `@cavi-ai/api-client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> `0.1.x` were unpublished pre-release iterations. `0.2.0` is the first tracked
> public release; the history below starts here.

## [Unreleased]

## [0.2.0] - 2026-05-27

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

[Unreleased]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/cavi-ai/cavi-api-client/releases/tag/v0.2.0

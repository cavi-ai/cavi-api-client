---
documentedVersion: 0.18.0
---

# Release changes

These notes are selected from the canonical repository CHANGELOG.md for
`@cavi-ai/api-client@0.18.0`. Unreleased changes are excluded.

Read [upgrade instructions](migration-and-support.md) before changing imports
or error-handling assumptions.

## [0.18.0] - 2026-10-02

### Removed

- Removed the deprecated team-registry forwarding exports from
  `./providers/hermes` (`createHermesTeamRegistry`, `TEAM_REGISTRY_CONFIG`,
  `TeamRegistryConfig`) and `./providers/openclaw`
  (`createOpenClawTeamRegistry`, `TEAM_REGISTRY_CONFIG`, `TeamRegistryConfig`).
  Import them from `./extensions/cavi`; see MIGRATION.md.

### Added

- Added `isApiClientError`, one guard for every error class the package
  throws. It is exported from the root and `./core/errors`.

### Changed

- The npm package ships only the brand image the README uses; the other
  logo and social-preview files are no longer packed.
- Every exported error class now extends `ApiClientError` and carries `type`
  and `code`: `HttpApiError`, `GatewayHttpError`, `GatewayRpcError`,
  `GatewayJobTimeoutError`, `GatewayJobAbortError`, `PortalConfigPatchError`,
  `GatewayAgentConfigApiError`, `CapabilityUnavailable`,
  `CapabilityCallRejected`, `OpenClawWireError`, and
  `WebhookVerificationError`. Existing guards (`isHttpApiError`,
  `isGatewayHttpError`) and classification behavior are unchanged.
- `GatewayHttpError.code` is now always a string. When the gateway sends no
  code, it is `gateway_error` (previously `null`).
- `GatewayJobAbortError` now satisfies `isAbortError`.
- Team manifest validation and resolution failures throw `ApiClientError` with
  type `configuration` and code `invalid_config` instead of a plain `Error`.
  Messages are unchanged.
- No source module throws or rejects with a plain `Error` any more. Messages
  are unchanged; each now carries a type and code:
  - caller input: `validation` / `validation_failed`
  - client, provider, or registry configuration: `configuration` /
    `invalid_config`
  - responses or frames that break the wire contract: `protocol_mismatch`,
    or `invalid_json` for unparseable bodies
  - no live gateway connection: `transport` / `socket_unavailable` or
    `socket_closed`
  - aborted waits and polls: `abort` / `aborted`, with name `AbortError`,
    so they now satisfy `isAbortError`
- `CapabilityClient` calls that fail caller-input validation inside the
  package (for example an unsupported media kind) now resolve to a
  `request-invalid` gap instead of rejecting.

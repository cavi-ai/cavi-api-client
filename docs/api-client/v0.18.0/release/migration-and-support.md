---
documentedVersion: 0.18.0
---

# Upgrade a consumer

Pin `@cavi-ai/api-client@0.18.0` and review the release changes
before updating your lockfile. These docs describe one artifact, not an
unreleased development branch.

## Import changes

Concrete providers belong under `providers/*`, CAVI-owned adapters under
`extensions/cavi`, React under `frameworks/react`, and Node-only transports
under `core/transport/node`. Use [the import inventory](../guides/imports.md)
instead of reaching into package source.

The deprecated Hermes and OpenClaw team-registry forwarding exports were
removed in earlier package versions. Import `createHermesTeamRegistry`,
`createOpenClawTeamRegistry`, `TEAM_REGISTRY_CONFIG`, and
`TeamRegistryConfig` from `@cavi-ai/api-client/extensions/cavi`.

Older Hermes mirror constructors for media, wiki, and WebSocket connections
were replaced by generic gateway constructors. Consult the
repository migration guide linked from the package README for the full mapping.

## Error handling

Every exported error class now extends `ApiClientError` with `type` and
`code`. Use `isApiClientError` to narrow exceptions. Where application code
expects nullable `GatewayHttpError.code`, handle a string instead; missing wire
codes become `gateway_error`. Existing auth and fallback classification rules
remain in effect.

On the facade, caller-input validation can return a `request-invalid` gap.
Keep handling both gaps and thrown auth/unclassified errors.
[Failure handling](../guides/errors.md)

## Integration checks

Compile against public imports, exercise consumed run/resource workflows,
check capability discovery, and verify abort/disposal behavior on your actual
backend. Beta Managed Agents and OpenCode's pinned server contract require
upstream compatibility checks. A successful package compile does not prove
every deployment resource is available.

[Release changes](changelog.md) · [Provider setup](../guides/providers.md)

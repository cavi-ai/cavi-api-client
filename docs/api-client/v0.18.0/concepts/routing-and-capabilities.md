---
documentedVersion: 0.18.0
---

# Capabilities and feature visibility

A provider name identifies an adapter; it does not prove that your deployment
has a particular resource, plugin, permission, or transport.

The package has static provider declarations and instance-level resolution.
On the facade, runtime-resolved values override the static fallback. Refresh
with `refreshCapabilities()` when configuration or the backend changes.

## Facade callers

Use `getCapabilityMap()` to decide which controls to show. Keep handling
`result.ok` on each call, because availability can change after discovery.
An accessor always exists; do not check for `client.sessions` to infer support.

Unsupported, unwired, invalid, or unavailable calls can return a structured
gap. Authentication and unclassified failures still throw.
[Error handling](../guides/errors.md) explains both paths.

## Raw runtime callers

Check `getRuntimeCapabilities()`, then `runtimeSupports(capabilities, surface)`
and the optional method before using it. The
[batch example](../examples/runtime-capabilities.ts) demonstrates this pattern.

## Routes and application ownership

Provider modules own their wire mappings. Team manifests can supply resource
identity and permitted relative workspace paths, but do not override provider
protocol semantics. Import public helpers rather than hardcoding endpoint
strings in your application. See [manifests](../guides/manifests.md).

---
documentedVersion: {{documentedVersion}}
---

# Describe teams and resource routing

A `TeamManifest` describes consumer-owned teams, members, identity, workspace
paths, and action configuration. The package owns its types, normalization,
and routing helpers; your application owns the actual entries.

Import the contract from `@cavi-ai/api-client/contracts`.
The [import example](../examples/narrow-imports.ts) includes the manifest type.

## Keep the boundary clear

Use team/member identity and permitted relative workspace paths to describe
resource access. Do not put credentials, transport behavior, host runtime
globals, or arbitrary filesystem assumptions in a team entry. A manifest is
configuration, not proof that an upstream route exists or permission is granted.

Facade teams resolve through an available manifest when no explicit backend is
supplied. An absent manifest results in a capability gap rather than invented
teams. Runtime owners remain responsible for the route's meaning and behavior.

## Verify before integration

Validate the manifest using the public contract helpers, exercise the consumed
team and workspace routes on your backend, and handle gaps from calls even
after a manifest resolves. Keep custom CAVI registry behavior in the extension
layer rather than treating it as part of every runtime.

[Contracts reference](../reference/contracts.md) ·
[Gateway resources](gateway.md) · [Capability discovery](../concepts/routing-and-capabilities.md)

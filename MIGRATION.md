# Migration guide

The package root is a curated provider-neutral API. Concrete providers,
extensions, framework bindings, and lower-level infrastructure are published as
subpath exports.

## Move concrete implementations to subpaths

| Previously imported from the root | Import from |
| --- | --- |
| CAVI control, portal, library, registry, and adapter symbols | `@cavi-ai/api-client/extensions/cavi` |
| Hermes clients and provider modules | `@cavi-ai/api-client/providers/hermes` |
| OpenClaw clients and provider modules | `@cavi-ai/api-client/providers/openclaw` |
| Claude clients and provider modules | `@cavi-ai/api-client/providers/claude` |
| Codex clients, provider modules, and files | `@cavi-ai/api-client/providers/codex` |
| Gemini clients, provider modules, and files | `@cavi-ai/api-client/providers/gemini` |
| HTTP clients and redaction helpers | `@cavi-ai/api-client/core/http` |
| Gateway resource clients | `@cavi-ai/api-client/core/gateway` |
| Shared transport factories | `@cavi-ai/api-client/core/transport` |
| Node-only stdio and Unix-socket transports | `@cavi-ai/api-client/core/transport/node` |
| React bindings | `@cavi-ai/api-client/frameworks/react` |
| Conformance helpers | `@cavi-ai/api-client/testing` |

See [Exports and import paths](docs/guides/exports.md) for the complete catalog
and recommended narrow provider entries.

## Prefer the universal runtime factory

Keep workflow code typed against `RuntimeClient`. At the application boundary,
register concrete provider modules and construct the client selected by
configuration. Do not make reusable workflow functions accept provider API
keys, provider-specific base URLs, or concrete provider client classes.

## Gate optional operations

Retrieval, cancellation, streaming, batch, and gateway resources are not
universal. Check the runtime capability and the optional method before invoking
it. Do not infer support from a provider name.

## Runtime control

Use the provider-neutral `createRuntimeControlClient` facade for canonical
control-plane modules. Provider-owned raw gateway behavior remains an optional
extension and should not be treated as a universal runtime capability.

## Provider migrations

Provider-specific request mapping and credentials are documented outside this
guide:

- [Providers and setup](docs/guides/providers.md)
- [Claude integrations](docs/guides/claude.md)
- [Operation reference](API.md)

The package mirrors upstream-compatible behavior; it does not redefine an
upstream runtime's canonical wire contract.

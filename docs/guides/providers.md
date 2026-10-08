# Providers and setup

The canonical consumer guide is [Choose and configure a provider](../api-client/source/pages/guides/providers.md).
It covers registration, credentials, capabilities, lifecycle differences, and
gateway configuration.

Application integrations should start with `createApiClient`, which returns a
`CapabilityClient`. Adapter authors and applications that need direct execution
methods can use the [raw runtime contract](../api-client/source/pages/concepts/runtime-client.md).
Do not mix their result or capability-checking conventions.

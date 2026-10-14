# OpenCode integration

Use the [OpenCode setup guide](../api-client/source/pages/guides/providers.md#opencode)
for registration, server compatibility, scope, and optional Basic authentication.

OpenCode is an opt-in runtime provider; it is not registered by default.
`OpenCodeApiClient` and `createOpenCodeProviderModule` target the legacy
`1.18.27` HTTP/SSE contract and support runs and streaming. The separate
`OpenCodeV2ApiClient` and `createOpenCodeV2ProviderModule` in 0.21.0 target v2
HTTP polling and declare `streaming: false`. Both omit batch and gateway
resources. See [v2 setup and constraints](provider-compatibility.md#opencode-v2)
before connecting to a v2 server; the legacy adapter does not auto-detect v2.

See [OpenCode operations](../api-client/source/pages/operations/providers/opencode.md)
for session lifecycle, streaming, cancellation, and cleanup behavior.

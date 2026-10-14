# AGY HTTP orchestration integration

Use the [AGY setup guide](../api-client/source/pages/guides/providers.md#agy)
for the required service URL, authentication, and module registration.

`AgyApiClient` connects to an application-provided HTTP orchestration service
implementing the documented routes and `x-agy-api-key` authentication. It does
not launch the `agy` CLI or the Antigravity SDK. Native CLI JSON/NDJSON output
and CLI-owned login are separate interfaces; they cannot be passed directly
to this HTTP adapter. See Google's [headless CLI documentation](https://www.antigravity.google/docs/cli/headless/)
for that transport.

The HTTP adapter supports runs and streaming, without batch or gateway resources.
Unreleased stream cleanup behavior is described in the
[provider compatibility guide](provider-compatibility.md#agy-stream-ownership).

See [AGY operations](../api-client/source/pages/operations/providers/agy.md)
and [stream failure handling](../api-client/source/pages/guides/streaming.md).

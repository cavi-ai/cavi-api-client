# OpenCode integration

OpenCode is an opt-in runtime-only provider for the
`@cavi-ai/api-client/providers/opencode` subpath. It is the next added harness
in this package, not a replacement for AGY. AGY remains the active successor
direction for new compatible orchestration integrations, while Gemini remains
available for legacy compatibility after its discontinuation as a direction for
new work.

## Supported contract

This adapter targets OpenCode server `1.18.27`, the `legacy-http-sse` endpoint
family. The wire contract was checked against the OpenAPI document with
SHA-256:

```text
46db986090aae41846cd6dbe16225a1d883f0bbcb4c48814008d3f6ce140aa5c
```

The client advertises only `runs` and `streaming`. It does not provide batch
processing or gateway resources. OpenCode is not part of the default provider
registry; an application must register its provider module explicitly.

```ts
import {
  createApiClient,
  createRuntimeProviderRegistry,
} from "@cavi-ai/api-client";
import {
  createOpenCodeProviderModule,
} from "@cavi-ai/api-client/providers/opencode";

const registry = createRuntimeProviderRegistry({
  modules: [createOpenCodeProviderModule({
    baseUrl: "http://127.0.0.1:4096",
    scope: {
      directory: "/absolute/path/to/project",
      workspace: "/absolute/path/to/workspace",
    },
    // Optional Basic auth; username defaults to "opencode" when password is set.
    username: process.env.OPENCODE_USERNAME,
    password: process.env.OPENCODE_PASSWORD,
  })],
});

const client = createApiClient("opencode", { registry });
```

`baseUrl` must be an absolute `http(s)` URL without embedded credentials,
query, or hash components. `scope.directory` must be an absolute path;
`scope.workspace` is optional and, when supplied, must be nonblank. The client
preserves these path strings and encodes them when building requests. Basic
authentication is optional. Any non-empty password, including whitespace,
enables Basic authentication; a username alone does not. When authentication
is enabled and no nonblank username is supplied, the username is `opencode`.

The public module also exports `OpenCodeApiClientOptions`,
`OPENCODE_RUNTIME_SUPPORT`, `OPENCODE_SERVER_VERSION`,
`OPENCODE_OPENAPI_SHA256`, `OPENCODE_ENDPOINT_FAMILY`, `OpenCodeScope`,
`validateOpenCodeScope`, and `encodeOpenCodeSessionId`. Route tables, request
builders, response mappers, and stream translators remain private
implementation details and are not extension points.

## Run lifecycle

For a non-dry run, the client probes health once per client, creates a scoped
session, and submits a synchronous message. The session ID is the canonical
`run_id`. `getRun` first returns a remembered terminal result without a
request; otherwise it reconciles the server session, session status, and
message history. Busy or retrying sessions remain `running`. A terminal
assistant result is cached; an absent session is reported as `unknown`.

`cancelRun` calls the session abort endpoint. A successful abort returns a
cancelled status; a negative server response leaves the run unknown unless a
previous terminal status was cached.

Dry runs are local: they validate and build the request shape but do not probe
the server, create a session, or send a message.

## Streaming behavior

Streaming uses the direct OpenCode SSE event endpoint. The event subscription is
opened before the `prompt_async` request is sent, so early events cannot be
missed. The prompt must receive HTTP 204 before the client treats it as
accepted. OpenCode streams have no reconnect or replay behavior; the adapter
does not synthesize completion when the stream ends without a terminal event.
Malformed frames are reported as non-terminal errors so later valid frames can
still be processed. Terminal events are delivered once and reconcile the local
run status.

Aborting the caller's signal stops event delivery, issues one best-effort
session abort when a session has been identified, and cleans up pending
responses and the SSE body. Abort cleanup is bounded even when an injected
transport does not promptly honor its signal. No credentials are included in
URLs, errors, status values, or trace metadata.

The stable documentation artifact under `docs/api-client/v0.16.0` describes a
previous release and intentionally does not include this unreleased OpenCode
subpath.

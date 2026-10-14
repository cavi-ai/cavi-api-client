# Provider compatibility additions

These additions require version 0.21.0 or newer. Existing provider defaults remain
compatible. The checked-in reference uses an independently pinned source snapshot;
published release documentation is built from that release's npm artifact.

## AGY stream ownership

The HTTP adapter releases its SSE response after observing `completed` or
`failed`, even when the server keeps the connection open. It delivers one
terminal event, then calls `onComplete`. Caller cancellation still stops local
streaming without synthesizing completion or cancelling backend work.

This applies to the compatible HTTP orchestration service; the native `agy`
CLI and Antigravity SDK use separate interfaces. See the [AGY setup guide](agy.md).

## OpenCode v2

Select v2 explicitly. `OpenCodeApiClient` and `createOpenCodeProviderModule`
continue to target the v1 `1.18.27` HTTP/SSE contract.

```ts
import { OpenCodeV2ApiClient } from "@cavi-ai/api-client/providers/opencode";

const client = new OpenCodeV2ApiClient({
  baseUrl: "http://127.0.0.1:4096",
  scope: { directory: "/workspace/project" },
  password: process.env.OPENCODE_SERVER_PASSWORD,
  defaultModel: "provider/model",
});
const run = await client.startRun({ input: "Explain this project" });
const current = await client.getRun(run.run_id);
```

The v2 module factory is `createOpenCodeV2ProviderModule`. Both forms support
Basic authentication, session creation, durable prompt admission, retrieval,
and interruption. A prompt acknowledgement returns `started`; only explicit
session outcomes produce `completed`, `failed`, or `cancelled`. An interrupt
acknowledgement with `interrupted: false` returns `unknown`.

V2 capabilities declare `streaming: false`. Configure instructions and tools on
the server agent. Message arrays, nonempty instructions, tools, metadata, and
the v1 workspace selector are rejected before session creation. Completed text
comes from the last assistant message, preserving whitespace and empty output.
History traversal has one operation deadline, a 100-page limit, cursor-loop
detection, and a 1 MiB text limit.

Native Python selects the same lifecycle without Node/npm:

```python
from cavi_runtime import create_runtime_client

async with create_runtime_client(
    "opencode", api_version=2,
    base_url="http://127.0.0.1:4096", directory="/workspace/project",
    password=server_password, default_model="provider/model",
) as client:
    run = await client.start_run({"input": "Explain this project"})
    current = await client.get_run(run["run_id"])
```

The native Python default remains `api_version=1`.

## Hermes profiles and dashboard authentication

For API Server profiles, supply the profile-prefixed `baseUrl` such as
`https://gateway.example/p/research` and that profile's API key. The client keeps
the prefix on all requests. The capability document selects native
`GET /api/sessions` pagination; extended servers retain their existing routes.
Native page limits are 0–200; returned cursors encode offsets up to 1,000,000.
Native API Servers do not expose session usage through the control-plane usage
surface; use an explicitly configured dashboard for analytics.

For the separate dashboard connection, set `dashboardProfile: "research"`
alongside `dashboardBaseUrl`, `dashboardWebSocketUrl`, and `dashboardToken`. REST calls
send `profile` in the query; structured session RPC calls send it in params.

```ts
import { createHermesRuntimeControlClient } from "@cavi-ai/api-client/providers/hermes";

export function createProfileControl(config: {
  apiServerUrl: string; apiServerKey: string; dashboardUrl: string;
  dashboardWebSocketUrl: string; dashboardToken: string; profile: string;
}) {
  return createHermesRuntimeControlClient({
    baseUrl: config.apiServerUrl,
    token: config.apiServerKey,
    dashboardBaseUrl: config.dashboardUrl,
    dashboardWebSocketUrl: config.dashboardWebSocketUrl,
    dashboardToken: config.dashboardToken,
    dashboardProfile: config.profile,
  });
}
```

Use the profile-prefixed API Server URL for `apiServerUrl` and the matching
dashboard profile. API Server and dashboard credentials are independent.
Owned WebSockets send the explicit dashboard token in the native `token` query.
URLs already containing `token`, `ticket`, or `internal` keep their credential.
Loopback dashboards accept their session token. Auth-gated dashboards require a
user session access token or a preauthenticated ticket URL; the dashboard's
process-local session token does not grant access through that gate. Tickets
are short-lived and single-use, so obtain a fresh ticket before reconnecting.
Use TLS and avoid logging authenticated WebSocket URLs. Borrowed channels and
raw RPC calls remain caller-configured.

## Observed Managed Agents completion

Set `observeRunCompletion: true` on `ClaudeManagedAgentClient` to rebuild
completion from full, ascending event history. Polling and canonical streams
require every observed workflow run to end, followed by a primary-thread idle
with `stop_reason.type: "end_turn"`. Budget pauses, tool waits, interrupted
turns, and termination are not successful completion. An interrupt returns
`stopping`; it does not prove all workflow runs have ended.

`listAllEvents(sessionId, signal?)` follows `next_page` with cursor-loop
detection, a 100-page limit, a 4 MiB history limit, and an operation deadline.
`listEvents` retains its existing single-page behavior. Configure
`observeRunCompletion: true` separately in `driveManagedAgentSession` options;
that mode requires a client exposing `listAllEvents` and replays the entire
history before evaluating completion. Caller cancellation stops streaming.

Native Python uses `observe_run_completion=True`. Its history and output bounds
derive from `max_response_bytes`; the full operation uses the configured timeout.
Both languages return exact text from the latest user turn only after observed
completion. Existing session-status mapping remains the default.

See the upstream [workflow completion contract](https://platform.claude.com/docs/en/managed-agents/workflow-runs).

## OpenClaw outcomes

Set `normalizeRunStatus: true` on `OpenClawApiClient` to map native `ok` to
`completed`, `error` to `failed`, `aborted` to `cancelled`, and `pending` or
`timeout` to `running`. `provider_status` retains the original status. Text
preserves whitespace and empty strings. The default retains the existing native
status and text normalization; native Python already uses canonical outcomes.

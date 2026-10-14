---
documentedVersion: {{documentedVersion}}
---

# Native Python runtime clients

Python 3.11+ can use all seven runtime providers directly. Native clients require
neither Node nor npm. HTTPX supplies HTTP transport; OpenClaw adds an optional
WebSocket dependency.

This reference describes the pinned release artifact. The unreleased native
OpenCode `api_version=2` and Managed Agents `observe_run_completion=True`
options are documented in the
[development compatibility guide](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/provider-compatibility.md).
Existing installs retain their current defaults.

## Install

From a checkout of this repository:

```sh
python -m pip install ./python
# For OpenClaw:
python -m pip install './python[openclaw]'
```

The Python project is named `cavi-runtime`; import `cavi_runtime`.
These source installs do not require a PyPI release.

## Configure a provider

| Provider kind | Configuration | Transport |
| --- | --- | --- |
| `claude-sdk` | `api_key`, `default_model` or request `model` | Claude Messages HTTP |
| `codex-responses` | `api_key`; optional `default_model` | OpenAI Responses HTTP |
| `claude-managed-agents` | `api_key` or `auth_token`, `agent_id`, `environment_id` | Managed Agents HTTP beta |
| `agy` | `base_url`, `default_model` or request `model`; optional `api_key` | AGY HTTP |
| `hermes` | `base_url`; optional `auth_token` or `api_key` | Hermes HTTP |
| `opencode` | `base_url`, absolute `directory`; optional `workspace`, `password` | Pinned OpenCode HTTP |
| `openclaw` | `ws_url`, `client_id`; gateway credentials and `scopes` | OpenClaw WebSocket RPC |

HTTP providers accept `base_url` overrides and a caller-owned
`httpx.AsyncClient`. Closing a runtime client leaves a supplied HTTP client open.
Otherwise, clients own and close their transport. Defaults are a 60-second
request deadline and 1 MiB decoded response limit; configure `timeout` and
`max_response_bytes` as needed. HTTP requests verify TLS, refuse redirects,
and do not retry operations.

Managed Agents uses provisioned agents and environments. Configure model,
instructions, and tools on the provisioned agent. Session metadata supports
`agent_id`, `agent_version`, `environment_id`, `title`, `resources`, and
`vault_ids`. OpenCode accepts string input, instructions, and `provider/model`
model IDs; nonempty tools and metadata are rejected.

AGY connects to an application-provided HTTP orchestration service. Native
`agy` CLI JSON/NDJSON and Antigravity SDK sessions are separate interfaces;
the native Python HTTP client does not launch either runtime.

OpenClaw defaults to protocol 4, operator role, and no scopes. Configure
`client_id`, `client_mode`, `scopes`, and `auth_token` accepted by your gateway.
For gateways requiring device identity, supply
`device_signer(nonce, connect_parameters)`, an optional async callback returning
a signed device object. Device credentials and signing stay application-owned.

## Use the lifecycle

```python
import asyncio
import os
from cavi_runtime import create_runtime_client

async def main():
    async with create_runtime_client(
        "codex-responses", api_key=os.environ["OPENAI_API_KEY"],
        default_model="YOUR_MODEL",
    ) as client:
        run = await client.start_run({"input": "Explain this code"})
        print(run["run_id"], run["status"])
        # Retrieve active work with get_run before requiring completed text.

asyncio.run(main())
```

| Method | Result |
| --- | --- |
| `get_runtime_capabilities()` | Lifecycle support; streaming and batch are false |
| `start_run(body)` | Run with `run_id`, `status`, and available output/usage |
| `get_run(run_id)` | Observed run state |
| `cancel_run(run_id)` | Explicit backend cancellation result |
| `require_completed_run(run)` | Completed run or typed outcome error |
| `require_run_text(run)` | Completed text, including an explicit empty string |
| `close()` | Release client-owned transport |

Claude Messages and AGY execute synchronously and retain up to 256 runs locally.
Their cancellation cannot stop a finished response. Other providers retrieve
backend state. OpenCode requires matching server/session version and directory;
idle status alone does not establish a completed assistant message.

OpenClaw maps native `ok`/`error` outcomes to `completed`/`failed` and retains
the original value as `provider_status`; unknown outcomes remain incomplete.
Response text preserves whitespace and explicit empty strings. Managed Agents
retrieves chronological `agent.message` text for completed sessions, excluding
user and tool events. Retrieval follows at most 100 event pages within one
request deadline and bounds accumulated text by `max_response_bytes`.

`dryRun: True` validates without starting backend work. Unknown, dry-run, and
incomplete states remain incomplete. Text helpers require successful completion.
Native clients cover lifecycle and completion helpers; streaming, batches, files,
gateway resources, and provider control APIs are outside this surface.

Catch `ApiClientError` for safe `code`, `type`, and optional `status`.
Deadlines raise `TimeoutError`; caller cancellation propagates
`asyncio.CancelledError`. Use `cancel_run` for explicit backend cancellation.
OpenCode also attempts to abort a newly created session when prompt submission
fails or is cancelled; other request deadlines and caller cancellations do not
cancel backend work. OpenClaw disconnects after failed or cancelled RPCs and reconnects
only on a subsequent explicit operation.

Closing OpenCode cancels active local submissions, attempts to abort their
newly created sessions, and then closes client-owned HTTP. Cancelling the
`close` call leaves cleanup running; call `close` again to wait for shutdown.

## Optional TypeScript bridge

`RuntimeClient.connect` remains available for application-owned TypeScript
adapters. This mode requires Node 20+ and uses a bounded JSON Lines subprocess.
See the [bridge guide](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/python-runtime-bridge.md).

Python CI builds the source archive and wheel, installs into a fresh environment,
and tests local HTTP/WebSocket transports with Node/npm absent from PATH on
Python 3.11 and 3.14. Shared fixtures check Claude, Codex, and AGY mappings against
TypeScript adapters. These tests do not call hosted provider services.

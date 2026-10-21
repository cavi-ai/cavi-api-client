# CAVI API Client for Python

Native async lifecycle clients for Claude Messages, Claude Managed Agents,
Codex Responses, AGY, Hermes, OpenCode, and OpenClaw. Python 3.11+ is required.
Native clients connect directly to provider servers; Node and npm are unnecessary.

The Python distribution is named `cavi-api-client`, matching
`@cavi-ai/api-client` on npm. Import the Python clients from `cavi_runtime`.

Version 0.21.0 includes OpenCode `api_version=2` and Managed Agents
`observe_run_completion=True`. See the
[provider compatibility guide](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/provider-compatibility.md) for setup
and supported operations.

Install from this repository before the first PyPI release:

```sh
python -m pip install ./python
```

HTTPX handles HTTP transport. OpenClaw additionally requires the optional
WebSocket transport: `python -m pip install './python[openclaw]'`.

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

asyncio.run(main())
```

Runs may remain active. Retrieve them with `get_run`; use `cancel_run` only for
explicit backend cancellation. `require_run_text` accepts completed text and
preserves explicit empty output. Native clients expose lifecycle operations,
not streaming, batches, or provider control planes.

Development source provides `wait_for_run` on native and bridge clients, plus a
standalone `cavi_runtime.wait_for_run(client, run, ...)` helper. The result
contains `reason`, the last observed `run`, and the retrieval count `polls`.
Defaults are 60 polls, a one-second delay before each poll, and a 60-second local
deadline including in-flight retrievals. Configure `max_polls`, `poll_interval`,
and `max_wait` in seconds. Terminal results include failed and cancelled runs;
use `require_run_text` only when your application requires successful text.

An optional `cancel_event=asyncio.Event()` stops the local wait with
`reason: "aborted"`. Cancelling the waiting task propagates `CancelledError`.
Neither action cancels backend work or an in-flight retrieval. Keep the client
open for its request to finish; provider errors after the local wait ends are
consumed. Explicit backend cancellation remains `cancel_run`.

OpenClaw normalizes `ok` to `completed` and `error` to `failed`, retaining the
original value as `provider_status`. Text preserves whitespace and empty strings.
Managed Agents retrieves chronological `agent.message` text for completed
sessions across at most 100 event pages, bounded by the request deadline and
the response byte limit for accumulated text. Tool and user events are excluded.
Managed Agents requires existing `agent_id` and `environment_id` configuration.
Set `metadata.agent_version` on `start_run` to pin a version; omitting it selects
the latest agent version when the session is created.
OpenCode closes by stopping active submissions and attempting session aborts
before releasing its HTTP transport. Cancelling `close` does not cancel cleanup;
call `close` again to wait for it.

The optional `RuntimeClient.connect` bridge remains available for existing
applications using a TypeScript adapter; only that mode requires Node.

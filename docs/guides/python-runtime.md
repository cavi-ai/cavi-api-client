# Python runtime access

Development builds include an async Python client for application-owned
`RuntimeClient` adapters. It requires Python 3.11+ and Node 20+. Python uses a
persistent subprocess, preserving adapter state and provider mappings. The
Python module ships with the npm package under `python/cavi_runtime`; it has
no third-party Python dependencies or separate PyPI distribution.

## Run locally

From a checkout with npm dependencies installed:

```sh
pnpm run build
export PYTHONPATH="$PWD/python"
python3 examples/runtime-bridge/answer.py \
  --bridge dist/core/transport/node/runtime-bridge-cli.js \
  --factory examples/runtime-bridge/claude.mjs \
  --model YOUR_MODEL 'Explain this code'
```

Supply `ANTHROPIC_API_KEY` through your credential manager or environment.
The example requires a model accepted by your provider. For an installed npm
package, use its `python` directory on `PYTHONPATH`, its executable
`cavi-runtime-bridge`, and an absolute path to your factory module.

## Own the adapter

A trusted ES module exports `createRuntimeClient()`, returning a
`RuntimeClient` or a promise for one. Construct your existing provider adapter
with its normal options. The factory owns provider selection, credentials,
base URLs, and model defaults. An optional `dispose()` on its returned client
runs when the CLI exits normally. Only load factory modules you trust: they
execute application code with the subprocess's permissions.

```js
import { CodexApiClient } from "@cavi-ai/api-client/providers/codex";

export function createRuntimeClient() {
  return new CodexApiClient({ apiKey: process.env.OPENAI_API_KEY });
}
```

Factories and adapters must reserve stdout for protocol frames. The Python
client discards stderr; raw provider diagnostic messages and causes
are excluded from wire errors. Pass credentials through the environment or
factory configuration. Use an argument vector; no shell is invoked.

## Use the lifecycle

```python
import asyncio
from cavi_runtime import ApiClientError, RuntimeClient

async def main():
    command = ["cavi-runtime-bridge", "/absolute/path/provider.mjs"]
    async with await RuntimeClient.connect(command, timeout=30) as client:
        run = await client.start_run({"input": "Explain this code"})
        try:
            text = await client.require_run_text(run)
        except ApiClientError as error:
            if error.code == "run_incomplete" and "getRun" in client.operations:
                # Store run["run_id"] and retrieve later; this performs one read.
                run = await client.get_run(run["run_id"])
                text = await client.require_run_text(run)
            else:
                raise
        print(text)

asyncio.run(main())
```

The wire retains TypeScript field names such as `run_id`, `dryRun`, and
`errorDetails`. Completion helpers run in TypeScript: explicit empty output
remains valid; failed, cancelled, unknown, and dry-run states never become
successful answers. `require_completed_run` accepts completed tool-only runs.

| Python method | Runtime operation |
| --- | --- |
| `get_runtime_capabilities()` | `getRuntimeCapabilities` |
| `start_run(body)` | `startRun` |
| `get_run(run_id)` | Optional `getRun` |
| `cancel_run(run_id)` | Optional `cancelRun` |
| `require_completed_run(run)` | `requireCompletedRun` |
| `require_run_text(run)` | `requireRunText` |

`client.operations` reports the callable bridge operations. `client.capabilities`
is the backend capability snapshot, which can include streaming or batches even
though this bridge exposes only lifecycle calls and completion helpers.
Optional method presence preserves the raw adapter contract; it does not
promise server-backed retrieval. Synchronous adapters remember terminal runs
only for the lifetime of this subprocess. Use the existing provider guides
for those semantics. Unsupported operations raise `ApiClientError` with
`code == "endpoint_not_found"`.

## Bound ownership and failures

Calls serialize within each client. The timeout covers writing the request
and reading its response after acquiring the call lock; queue time is excluded.
Timeout, cancellation during an active call, process exit, or malformed
responses close and reap the child. Cancellation while queued leaves the
active call intact. Cancelling `close()` defers cancellation until the owned
child has been reaped. Always use the async context manager or `await client.close()`.

Closing the subprocess does not issue backend cancellation. A submitted run
may remain active, and a timed-out start may have succeeded without returning
an ID. Reconcile using provider records; do not blindly repeat the start.
Only `cancel_run` explicitly requests cancellation, using the adapter's normal
behavior. This bridge provides no automatic retries or reconnection.

Remote failures raise `ApiClientError` with `code`, `type`, and optional HTTP
`status`. They preserve a usable channel. Local framing and connection failures
raise `BridgeError`; deadlines raise `TimeoutError`; task cancellation retains
`asyncio.CancelledError`. Invalid local JSON and oversized requests raise
`ValueError` before transmission. Process-spawn failures retain `OSError`.

## Protocol and Node embedding

`serveRuntimeBridge` is exported only from
`@cavi-ai/api-client/core/transport/node`. Pass `{ client, input, output }` with
Node byte streams. The caller owns those streams and the adapter; the function
does not dispose or cancel them. Malformed input rejects the serving promise.

Protocol version 1 uses UTF-8 JSON Lines with a 1 MiB limit per request or
response, excluding the newline. Requests are `{ v: 1, id, method, params }`;
IDs are positive safe integers. Success replies contain `{ v, id, ok: true,
result }`; failures contain `{ v, id, ok: false, error }`. Error fields are
`name`, `message`, `type`, `code`, and optional `status`. `describe` returns
`protocolVersion`, `maxFrameBytes`, `operations`, and `capabilities`. The Python
client validates that handshake, correlation, framing, and error envelopes.

Run `pnpm run test:python` to build and exercise the extracted npm artifact
through Python, the Node CLI, existing adapters, and a local HTTP server.
The package's Node tests also cover framing, unsupported operations, and
completion behavior. These tests do not establish compatibility with a live
provider service.

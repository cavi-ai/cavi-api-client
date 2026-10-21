# Python runtime access

Use the [native Python guide](../api-client/v0.20.0/guides/python.md) for pip
installation, all seven providers, and lifecycle calls. Native clients require
no Node/npm. HTTPX is required; OpenClaw adds an optional WebSocket dependency.

Version 0.21.0 includes OpenCode `api_version=2` and Managed Agents
`observe_run_completion=True`. See the
[provider compatibility guide](provider-compatibility.md) for their supported
operations and completion rules.

Applications owning TypeScript adapters can use the
[optional runtime bridge](python-runtime-bridge.md), which requires Node 20+.

## Bounded polling (0.22.0)

Native and bridge clients provide `wait_for_run(run, max_polls=60,
poll_interval=1.0, max_wait=60.0)`. The standalone `cavi_runtime.wait_for_run`
accepts a client as its first argument. Delays and the overall local deadline
use seconds; the deadline includes pending retrievals.

The typed `RunWaitResult` retains `reason`, the last observed `run`, and `polls`.
Reasons are `terminal`, `state-not-pollable`, `poll-limit`, `timeout`, or
`aborted`. `terminal` includes failed and cancelled runs. An optional
`cancel_event` stops this local wait; task cancellation propagates
`asyncio.CancelledError`. Neither stops backend execution or a pending read.
Keep the client open until its transport work settles.

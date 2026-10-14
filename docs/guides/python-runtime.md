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

# Hermes Gateway API

This is the canonical API inventory for the base Hermes gateway API server in
`gateway/platforms/api_server.py`. It covers the aiohttp platform adapter that
defaults to `http://127.0.0.1:8642`.

This document does not cover the dashboard backend in `hermes_cli/web_server.py`
and does not inline plugin-owned routes. Plugin routes are mounted by
`ctx.register_api_server_route(...)` and are documented in each plugin's
`API.md`.

## Source Of Truth

- Route registration: `APIServerAdapter.connect()`
- Capability payload: `GET /v1/capabilities`
- Plugin route mount point: `APIServerAdapter._mount_plugin_api_routes()`

## Authentication

All base routes except health checks call `_check_auth()`.

- If `API_SERVER_KEY` or `platforms.api_server.key` is configured, callers must
  send `Authorization: Bearer <key>`.
- If no key is configured, local-only use is allowed.
- Binding the server to a network-accessible host requires a usable API key.

Common headers:

- `Authorization: Bearer <key>`
- `Idempotency-Key: <stable request key>` for non-streaming chat/responses
- `X-Hermes-Session-Id: <session id>` for authenticated session continuation
- `X-Hermes-Session-Key: <stable channel key>` for authenticated long-term
  memory scoping

## Base Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | No | Simple health check. |
| GET | `/healthz` | No | Alias for `/health`. |
| GET | `/readyz` | No | Alias for `/health`. |
| GET | `/health/detailed` | No | Runtime status, platform state, active agents, PID. |
| GET | `/v1/health` | No | OpenAI-style health alias. |
| GET | `/v1/models` | Yes | List the configured Hermes model. |
| GET | `/v1/capabilities` | Yes | Machine-readable base API and plugin capability contract. |
| POST | `/v1/chat/completions` | Yes | OpenAI-compatible Chat Completions facade. |
| POST | `/v1/responses` | Yes | OpenAI-compatible Responses facade. |
| GET | `/v1/responses/{response_id}` | Yes | Retrieve a stored response. |
| DELETE | `/v1/responses/{response_id}` | Yes | Delete a stored response. |
| GET | `/api/jobs` | Yes | List cron jobs. |
| POST | `/api/jobs` | Yes | Create a cron job. |
| GET | `/api/jobs/{job_id}` | Yes | Read one cron job. |
| PATCH | `/api/jobs/{job_id}` | Yes | Update one cron job. |
| DELETE | `/api/jobs/{job_id}` | Yes | Delete one cron job. |
| POST | `/api/jobs/{job_id}/pause` | Yes | Pause one cron job. |
| POST | `/api/jobs/{job_id}/resume` | Yes | Resume one cron job. |
| POST | `/api/jobs/{job_id}/run` | Yes | Trigger one cron job immediately. |
| POST | `/v1/runs` | Yes | Start an async Hermes run and return a `run_id`. |
| GET | `/v1/runs/{run_id}` | Yes | Poll run status. |
| GET | `/v1/runs/{run_id}/events` | Yes | Stream run lifecycle events as SSE. |
| POST | `/v1/runs/{run_id}/approval` | Yes | Resolve a pending approval request. |
| POST | `/v1/runs/{run_id}/stop` | Yes | Interrupt a running agent. |

## Health

`GET /health`, `/healthz`, `/readyz`, and `/v1/health` return:

```json
{"status": "ok", "platform": "hermes-agent"}
```

`GET /health/detailed` returns the same platform identity plus gateway runtime
state, connected platforms, active-agent count, exit reason, status timestamp,
and server PID.

## Capabilities

`GET /v1/capabilities` returns:

- `auth`: bearer auth type and whether it is required
- `runtime`: server-side tool execution mode
- `features`: support flags for chat, responses, runs, SSE, approvals, CORS,
  and Hermes session headers
- `endpoints`: stable base route contract
- `extensions.plugins`: capability payloads contributed by enabled plugins

## Chat Completions

`POST /v1/chat/completions` accepts an OpenAI Chat Completions-shaped body:

```json
{
  "model": "optional-client-model-name",
  "messages": [
    {"role": "system", "content": "optional instructions"},
    {"role": "user", "content": "hello"}
  ],
  "stream": false
}
```

Request notes:

- `messages` is required and must be a list.
- `system` messages are joined and applied as an ephemeral system prompt.
- `user` and `assistant` history is accepted; the last visible user payload is
  the active turn.
- Text content may be a string or text part list.
- Image parts are accepted as `image_url` or `input_image` with `http(s)` URLs
  or `data:image/...` URLs.
- File parts and non-image data URLs are rejected.
- `X-Hermes-Session-Id` loads prior transcript history from `state.db`; this
  requires API-key auth.
- Without `X-Hermes-Session-Id`, the server derives a deterministic session id
  from the first user message and system prompt.
- `X-Hermes-Session-Key` scopes long-term memory and also requires API-key auth.
- `Idempotency-Key` is honored for non-streaming requests.

Responses:

- Non-streaming returns an OpenAI-style `chat.completion` object with
  `choices`, `usage`, and `X-Hermes-Session-Id`.
- Streaming returns `text/event-stream` chunks, including text deltas and
  structured `hermes.tool.progress` events.
- Partial or failed agent runs set Hermes headers such as
  `X-Hermes-Completed`, `X-Hermes-Partial`, and `X-Hermes-Error`.

## Responses

`POST /v1/responses` accepts an OpenAI Responses-shaped body:

```json
{
  "model": "optional-client-model-name",
  "instructions": "optional instructions",
  "input": "hello",
  "previous_response_id": "resp_...",
  "conversation": "optional-named-chain",
  "conversation_history": [],
  "stream": false,
  "store": true
}
```

Request notes:

- `input` is required and may be a string or an array of strings/message
  objects.
- `instructions` becomes the ephemeral system prompt.
- `previous_response_id` chains from a stored response.
- `conversation` resolves to the latest stored response id for that named
  conversation.
- `conversation` and `previous_response_id` are mutually exclusive.
- Explicit `conversation_history` takes precedence over `previous_response_id`.
- `truncation: "auto"` keeps only the last 100 history messages.
- `stream: true` returns OpenAI Responses SSE events.
- `store: false` skips storing the response for later chaining.
- `X-Hermes-Session-Key` is supported.
- `Idempotency-Key` is honored for non-streaming requests.

Stored response endpoints:

- `GET /v1/responses/{response_id}` returns the stored response object.
- `DELETE /v1/responses/{response_id}` deletes it and returns
  `{"deleted": true}`.

## Cron Jobs

Cron job endpoints require the cron module to be available; otherwise they
return `501`.

`GET /api/jobs` query parameters:

- `include_disabled=true|1` includes disabled jobs.

`POST /api/jobs` body:

```json
{
  "name": "daily summary",
  "schedule": "0 9 * * *",
  "prompt": "Summarize yesterday.",
  "deliver": "local",
  "skills": ["optional-skill"],
  "repeat": 1
}
```

Validation:

- `name` is required and capped at 200 characters.
- `schedule` is required.
- `prompt` is capped at 5000 characters.
- `repeat`, when present, must be a positive integer.

`PATCH /api/jobs/{job_id}` accepts only:

- `name`
- `schedule`
- `prompt`
- `deliver`
- `skills`
- `skill`
- `repeat`
- `enabled`

`job_id` must match `[a-f0-9]{12}`.

## Runs

`POST /v1/runs` starts an asynchronous agent run and returns immediately:

```json
{
  "run_id": "run_<uuid>",
  "status": "started"
}
```

Request body:

```json
{
  "model": "optional-client-model-name",
  "input": "Run this task",
  "instructions": "optional instructions",
  "previous_response_id": "resp_...",
  "conversation_history": [],
  "session_id": "optional-session-id"
}
```

Request notes:

- `input` is required and may be a string or a multi-message list.
- `instructions` becomes the ephemeral system prompt.
- `conversation_history` must be an array of `{role, content}` objects.
- If `previous_response_id` is supplied and exists, stored history and
  instructions are carried forward.
- `session_id` controls the Hermes session id; otherwise the run id is used.
- `X-Hermes-Session-Key` scopes long-term memory and approval identity.
- The server keeps at most 10 concurrent run streams.
- Unconsumed run streams are swept after 300 seconds.

`GET /v1/runs/{run_id}` returns the pollable status object:

```json
{
  "object": "hermes.run",
  "run_id": "run_...",
  "status": "running",
  "created_at": 0,
  "updated_at": 0,
  "session_id": "..."
}
```

Known statuses include `queued`, `running`, `waiting_for_approval`,
`completed`, `failed`, `cancelled`, and `stopping`.

`GET /v1/runs/{run_id}/events` streams SSE frames. Event payloads include:

- `message.delta`
- `tool.started`
- `tool.completed`
- `reasoning.available`
- `approval.request`
- `approval.responded`
- `run.completed`
- `run.failed`
- `run.cancelled`

The stream sends keepalive comments every 30 seconds and closes after a terminal
run event.

`POST /v1/runs/{run_id}/approval` body:

```json
{"choice": "once", "all": false}
```

Allowed `choice` values are `once`, `session`, `always`, and `deny`. Aliases
`approve`, `approved`, and `allow` map to `once`. `all` or `resolve_all`
resolves all pending approvals for the run's approval session.

`POST /v1/runs/{run_id}/stop` interrupts the active agent and returns:

```json
{"run_id": "run_...", "status": "stopping"}
```

## Plugin Extensions

Enabled plugins can add API server routes through
`ctx.register_api_server_route(method, path, handler, name=...)`. The base
server mounts those after the core routes at startup.

Plugin capability providers appear under `extensions.plugins` in
`GET /v1/capabilities`. See:

- `plugins/fleet-router/API.md`
- `plugins/cavi-control/API.md`

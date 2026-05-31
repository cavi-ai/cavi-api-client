# CAVI Control / cc-hermes Plugin API

This document covers API routes registered by the local `cavi-control` plugin
checkout, which is the cc-hermes/CAVI mobile compatibility surface. The source
of truth is `plugins/cavi-control/api/routes.py`.

The plugin uses the base Hermes API server for auth, CORS, body limits, and
route mounting. When the base server requires `API_SERVER_KEY`, these routes use
the same `Authorization: Bearer <key>` header.

Legacy `/operator/api/*`, `/cavi-control/api/*`, `/front-door/api/*`,
`/machine/api/*`, `/martina/api/*`, `/scout/api/*`, `/angela/api/*`, and
`/trading/api/*` paths are not registered by this plugin. Use the canonical
API-first paths below.

## Source Of Truth

- Plugin registration: `plugins/cavi-control/plugin.py`
- Route table: `api/routes.py::ROUTES`, `LIBRARY_ROUTES`, `SESSION_ROUTES`
- Session handlers: `api/sessions.py`
- Library handlers: `api/library.py`
- Capability payload: `contracts/capabilities.py`

## Endpoint Inventory

### Kanban

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/kanban` | Return the local Kanban board projection. |
| GET | `/api/plugins/kanban/board` | Alias for the local Kanban board projection. |
| GET | `/api/plugins/kanban/tasks` | Return projected Kanban tasks. |
| POST | `/api/plugins/kanban/tasks` | Enqueue a local Kanban task. |

### Operator

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/cavi-control/operator/status` | Runtime/operator status projection. |
| GET | `/api/plugins/cavi-control/operator/snapshot` | Combined operator control snapshot. |
| GET | `/api/plugins/cavi-control/operator/registry` | Operator registry projection. |
| GET | `/api/plugins/cavi-control/operator/memory` | Operator memory projection. |
| GET | `/api/plugins/cavi-control/operator/worker/ready` | Ready worker/task projection. |
| GET | `/api/plugins/cavi-control/operator/worker/tasks` | Worker task projection. |
| GET | `/api/plugins/cavi-control/operator/tasks` | Operator task list, delegated to Kanban tasks. |
| POST | `/api/plugins/cavi-control/operator/tasks` | Enqueue an operator task. |
| GET | `/api/plugins/cavi-control/operator/tasks/{task_id}` | Read one operator task projection. |
| GET | `/api/plugins/cavi-control/operator/tasks/{task_id}/discourse` | Read task discourse/comments/events projection. |

### Deb

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/cavi-control/deb` | Deb workspace summary. |
| GET | `/api/plugins/cavi-control/deb/profile` | Deb profile projection. |
| GET | `/api/plugins/cavi-control/deb/sprint` | Deb sprint projection. |
| GET | `/api/plugins/cavi-control/deb/backlog` | Deb backlog projection. |
| POST | `/api/plugins/cavi-control/deb/call` | Enqueue a Deb call/task. |

### Front Door

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/front-door/dashboard` | Front Door dashboard projection. |
| GET | `/api/plugins/front-door/ideas` | List idea projections. |
| POST | `/api/plugins/front-door/ideas` | Create/enqueue an idea. |
| GET | `/api/plugins/front-door/ideas/{idea_id}` | Read one idea projection. |
| PATCH | `/api/plugins/front-door/ideas/{idea_id}` | Patch/enqueue idea update metadata. |
| POST | `/api/plugins/front-door/ideas/{idea_id}/promote` | Promote/enqueue idea work. |
| GET | `/api/plugins/front-door/projects` | List project projections. |
| GET | `/api/plugins/front-door/projects/{project_id}` | Read one project projection. |
| GET | `/api/plugins/front-door/articles` | List article projections. |
| POST | `/api/plugins/front-door/articles` | Create/enqueue article work. |
| GET | `/api/plugins/front-door/memory` | Front Door memory projection. |
| POST | `/api/plugins/front-door/memory` | Create/enqueue memory work. |
| POST | `/api/plugins/front-door/inbox` | Create/enqueue inbox item. |

### Trading

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/trading/dashboard` | Trading workspace dashboard projection. |
| GET | `/api/plugins/trading/research-packets` | Trading research packet projection. |
| GET | `/api/plugins/trading/source-registry` | Trading source registry projection. |

### Obsidian

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/obsidian/tree` | Local Sigmund/Obsidian tree projection. |
| GET | `/api/obsidian/read` | Read a local Sigmund/Obsidian note. |

### Portal

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/portal/{portal}/dashboard` | Canonical portal dashboard dispatcher. |
| GET | `/api/plugins/portal/martina/config` | Martina config projection. |
| POST | `/api/plugins/portal/martina/config` | Persist Martina config payload. |
| GET | `/api/plugins/portal/martina/runs` | Martina run list projection. |
| GET | `/api/plugins/portal/martina/runs/{run_id}` | Martina run detail projection. |
| POST | `/api/plugins/portal/martina/doctor` | Martina doctor/check action. |
| POST | `/api/plugins/portal/martina/queues/move` | Move a Martina queue item. |
| GET | `/api/plugins/portal/martina/artifacts/{bucket}/{name}` | Download a Martina artifact. |
| GET | `/api/plugins/portal/martina/artifacts/{bucket}/{name}/preview` | Preview a Martina artifact. |
| GET | `/api/plugins/portal-memory/teams/{teamSlug}/members/{memberId}/{memoryKey}` | Portal memory snapshot. |

Portal dashboard aliases:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/portal/martina/dashboard` | Martina dashboard via canonical portal dispatcher. |
| GET | `/api/plugins/portal/scout/dashboard` | Scout dashboard via canonical portal dispatcher. |
| GET | `/api/plugins/portal/angela/dashboard` | Angela dashboard via canonical portal dispatcher. |

The three alias paths above are advertised by capabilities. The mounted generic
route is `/api/plugins/portal/{portal}/dashboard`.

### Machine

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/plugins/machine/comedy/run` | Convert a machine comedy request into a base `/v1/runs` request. |
| GET | `/api/plugins/machine/dashboard` | Machine workspace dashboard projection. |
| GET | `/api/plugins/machine/media` | Download local machine media by `name`. |
| GET | `/api/plugins/machine/tts/providers` | TTS provider environment projection. |
| POST | `/api/plugins/machine/tts` | Return a local placeholder WAV response. |
| GET | `/api/plugins/machine/meme/jobs` | List local meme queue buckets. |
| POST | `/api/plugins/machine/meme/jobs` | Enqueue a local meme job. |
| GET | `/api/plugins/machine/inbox` | List local machine inbox items. |
| POST | `/api/plugins/machine/inbox` | Write a local machine inbox item. |

### Library

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/library/fleet-status` | Library fleet/team status projection. |
| GET | `/api/plugins/library/status` | Library readiness/status projection. |
| GET | `/api/plugins/library/inbox` | Pending library inbox items. |
| GET | `/api/plugins/library/promotable` | Reviewable/promotable library docs. |
| GET | `/api/plugins/library/review-requests` | Pending library review requests. |
| GET | `/api/plugins/library/search` | Search local workspace library files. |
| POST | `/api/plugins/library/clip` | Persist a clip as markdown in the local library inbox. |

### Sessions

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/sessions/list` | List projected Hermes sessions. |
| POST | `/api/sessions/list` | List projected Hermes sessions from JSON body params. |
| GET | `/api/sessions/usage` | Return session usage aggregates. |
| POST | `/api/sessions/usage` | Return session usage aggregates from JSON body params. |
| POST | `/api/sessions/preview` | Return message previews for session keys. |
| POST | `/api/sessions/new` | Create a new session record. |
| POST | `/api/sessions/create` | Alias for `/api/sessions/new`. |
| GET | `/api/sessions/detail` | Return one session detail from query params. |
| POST | `/api/sessions/detail` | Return one session detail from JSON body params. |
| PATCH | `/api/sessions/patch` | Patch supported session fields. |
| POST | `/api/sessions/patch` | Alias for session patch. |
| GET | `/api/sessions/metrics` | Return richer session metrics. |
| POST | `/api/sessions/metrics` | Return richer session metrics from JSON body params. |

### Cost And Scoring

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/cavi-control/cost/history` | Cost history projection. |
| GET | `/api/plugins/cavi-control/scoring/model` | Scoring model projection. |

### Wu-Tang GitHub Proxy

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plugins/wu-tang/github` | Proxy GitHub REST API root with server-side token custody. |
| GET | `/api/plugins/wu-tang/github/{tail:.*}` | Proxy a GitHub REST API path with server-side token custody. |

Requires `GITHUB_TOKEN` or `GH_TOKEN`. Without a token the handler returns a
contract-gap response instead of exposing credentials.

## Session API Parameters

The session handlers accept query parameters on `GET` and JSON object fields on
`POST`/`PATCH`.

Common filters:

- `target_profile`, `targetProfile`, `target_agent`, `targetAgent`, `agent_id`,
  or `agentId`: select another profile's session database.
- `limit`: default `80`, min `1`, max `500`.
- `offset`: default `0`, max `10000`.
- `activeMinutes` or `active_minutes`: only include recently active sessions.
- `search`: substring filter across id, title, preview, source, and model.
- `key`: session key for detail/usage/metrics/patch.

Preview/detail controls:

- `keys`: array of session ids for `/api/sessions/preview`.
- `previewLimit`: default `24`, max `200`.
- `messageLimit` or `messagesLimit`: default `200`, max `1000`.
- `maxChars` or `max_chars`: preview max text length, max `5000`.
- `messageMaxChars` or `messagesMaxChars`: transcript max text length, max
  `100000`.

Create session fields:

- `session_id`, `sessionId`, or `key`: optional explicit id.
- `label` or `title`: optional display title.
- `model`: optional model label.
- `channel` or `source_name`: optional source label.

Patch session fields:

- `key`: required.
- `label`: supported title update.
- `thinkingLevel`, `fastMode`, `verboseLevel`, and `reasoningLevel` are
  reported as unsupported when present.

## Library API Parameters

`GET /api/plugins/library/search` accepts:

- `q` or `query`: search text. Empty queries return no workspace scan.

`POST /api/plugins/library/clip` accepts:

```json
{
  "title": "Clip title",
  "text": "Captured content",
  "note": "Optional note",
  "source_url": "https://example.com",
  "tags": ["research"],
  "metadata": {"source": "mobile"},
  "team": "front-door"
}
```

At least one of `title`, `text`, `source_url`/`sourceUrl`, or `note` is
required. The handler writes a markdown note into the selected local workspace
library inbox and returns explicit `source`, `connectorStatus`, `contractGaps`,
and `limitations` metadata.

## Machine API Notes

- `GET /api/plugins/machine/media` requires `name=<file name>`.
- `POST /api/plugins/machine/tts` currently returns a minimal local placeholder
  WAV and sets `X-Hermes-TTS-Status`, `X-Hermes-TTS-Mode`, and
  `X-Hermes-Connector-Status` headers.
- `POST /api/plugins/machine/meme/jobs` writes a sanitized payload into the
  local review queue.
- `POST /api/plugins/machine/inbox` accepts JSON or multipart payloads and
  writes local inbox artifacts.
- `POST /api/plugins/machine/comedy/run` accepts `topic`, `title`, `prompt`,
  `input`, `text`, and `model`, then starts a base Hermes run for the Chris
  comedy workflow.

## Data Contract Notes

Most cc-hermes endpoints are compatibility projections over local Hermes state:
Kanban, SessionDB, local workspace files, runtime status, and local queues. When
an external connector is not configured, responses intentionally include fields
such as `source`, `connectorStatus`, `contractGaps`, `limitations`, or
`sectionStatus` instead of pretending the backing service is live.

`POST /v1/runs` remains the base Hermes run API and is documented in the root
`API.md`. This plugin advertises that route in capabilities for mobile clients,
but the actual mounted plugin compatibility route is
`POST /api/plugins/machine/comedy/run`.

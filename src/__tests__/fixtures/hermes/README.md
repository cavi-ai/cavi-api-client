# Sanitized Hermes protocol fixtures

These deterministic examples preserve protocol structure from upstream Hermes
source without copying runtime state, logs, credentials, user paths, prompts, or
identities. All fixtures were transcribed and sanitized from upstream commit
`de1950c24b214d0127dc72eeb73fdcd90d841d14`.

| Fixture | Upstream source | Commit | Sanitization |
| --- | --- | --- | --- |
| `session-list-request.json` | `tui_gateway/server.py` (`session.list`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Deterministic RPC id and limit only. |
| `session-list-result.json` | `tui_gateway/server.py` (`session.list`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced session id, title, preview, timestamps, and counts. |
| `session-usage-result.json` | `tui_gateway/server.py` (`session.usage`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced RPC id and usage counts. |
| `session-interrupt-result.json` | `tui_gateway/server.py` (`session.interrupt`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced RPC id; retained status literal. |
| `error-response.json` | `tui_gateway/server.py` (`_err`, `handle_request`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Uses a nonexistent deterministic method and RPC id. |
| `event-notification.json` | `tui_gateway/entry.py` (gateway-ready write) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Retains public event envelope and stable skin value only. |
| `sessions.json` | `hermes_cli/web_server.py` (`get_sessions`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced identity, model, timestamps, and counts. |
| `session-detail.json` | `hermes_cli/web_server.py` (`get_session_detail`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced identity, model, timestamps, usage, and cost. |
| `session-delete.json` | `hermes_cli/web_server.py` (`delete_session_endpoint`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Retains the exact boolean acknowledgement with no runtime data. |
| `config.json` | `hermes_cli/web_server.py` (`get_config`, `_normalize_config_for_web`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced model and toolset identities; retained representative nested JSON values. |
| `analytics-usage.json` | `hermes_cli/web_server.py` (`get_usage_analytics`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced dates, model, usage, costs, and counts. |
| `models.json` | `hermes_cli/inventory.py` (`build_models_payload`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced provider and model identities. |
| `provider-auth.json` | `hermes_cli/web_server.py` (`list_oauth_providers`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced provider identity and origin; omitted credential previews. |
| `malformed.json` | `hermes_cli/web_server.py` (`get_sessions`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Synthetic structurally invalid response; valid JSON for parser tests. |
| `run-events.txt` | `gateway/platforms/api_server.py` (`_handle_run_events`, `_make_run_event_callback`) | `de1950c24b214d0127dc72eeb73fdcd90d841d14` | Replaced run id, timestamps, text, tool name, duration, and usage. |

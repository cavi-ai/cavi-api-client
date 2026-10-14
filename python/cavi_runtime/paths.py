"""Provider route owners. Identifiers are encoded as individual URL segments."""
from urllib.parse import quote, urlencode

CLAUDE_MESSAGES = "/v1/messages"
CODEX_RESPONSES = "/v1/responses"
AGY_RUN = "/v1/agents/run"
HERMES_RUNS = "/v1/runs"
MANAGED_SESSIONS = "/v1/sessions"
OPENCODE_HEALTH = "/global/health"
OPENCODE_SESSIONS = "/session"
OPENCODE_VERSION = "1.18.27"


def segment(value: str) -> str:
    if not isinstance(value, str) or not value.strip() or value in (".", ".."):
        raise ValueError("A nonblank resource identifier is required")
    return quote(value, safe="")


def resource(collection: str, identifier: str, suffix: str = "") -> str:
    return collection + "/" + segment(identifier) + suffix


def opencode_path(directory: str, workspace: str | None, identifier: str | None = None, suffix: str = "") -> str:
    route = OPENCODE_SESSIONS
    if identifier is not None:
        if not isinstance(identifier, str) or not identifier.startswith("ses_"):
            raise ValueError("OpenCode session IDs must begin with ses_")
        route = resource(route, identifier)
    query = {"directory": directory}
    if workspace is not None:
        query["workspace"] = workspace
    return route + suffix + "?" + urlencode(query, quote_via=quote)

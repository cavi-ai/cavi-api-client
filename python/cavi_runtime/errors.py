"""Stable error vocabulary shared by native clients and the optional bridge."""

from typing import Any


class BridgeError(Exception):
    """The local bridge is unavailable or violated its protocol."""


class ApiClientError(Exception):
    """Structured runtime failure, without provider messages or raw causes."""

    def __init__(self, error: dict[str, Any]):
        super().__init__(error["message"])
        self.code: str = error["code"]
        self.type: str = error["type"]
        self.status: int | float | None = error.get("status")

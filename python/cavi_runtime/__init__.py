"""Native Python runtime clients with an optional TypeScript adapter bridge."""

from .errors import ApiClientError, BridgeError

__all__ = [
    "ApiClientError",
    "BridgeError",
    "RuntimeClient",
    "NativeRuntimeClient",
    "create_runtime_client",
    "wait_for_run",
    "RunWaitResult",
]


def __getattr__(name):
    if name in ("wait_for_run", "RunWaitResult"):
        from .wait import RunWaitResult, wait_for_run

        return {"wait_for_run": wait_for_run, "RunWaitResult": RunWaitResult}[name]
    if name == "RuntimeClient":
        from .client import RuntimeClient

        return RuntimeClient
    if name in ("NativeRuntimeClient", "create_runtime_client"):
        from .native import NativeRuntimeClient, create_runtime_client

        return {
            "NativeRuntimeClient": NativeRuntimeClient,
            "create_runtime_client": create_runtime_client,
        }[name]
    raise AttributeError(name)

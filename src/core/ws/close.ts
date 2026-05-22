export type WebSocketCloseLike = {
  code?: unknown;
  reason?: unknown;
};

export type WebSocketCloseDescription = {
  code: number | null;
  reason: string | null;
  message: string;
};

export function describeWebSocketClose(
  event?: WebSocketCloseLike | null,
  fallbackMessage = "websocket closed",
): WebSocketCloseDescription {
  const code =
    typeof event?.code === "number" && Number.isFinite(event.code)
      ? Math.round(event.code)
      : null;
  const reason =
    typeof event?.reason === "string" && event.reason.trim().length > 0
      ? event.reason.trim()
      : null;

  if (code !== null && reason) {
    return {
      code,
      reason,
      message: `${fallbackMessage} (${code}): ${reason}`,
    };
  }
  if (code !== null) {
    return {
      code,
      reason: null,
      message: `${fallbackMessage} (${code})`,
    };
  }
  if (reason) {
    return {
      code: null,
      reason,
      message: `${fallbackMessage}: ${reason}`,
    };
  }
  return {
    code: null,
    reason: null,
    message: fallbackMessage,
  };
}

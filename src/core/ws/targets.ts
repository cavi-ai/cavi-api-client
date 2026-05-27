export type HttpWebSocketTargets = {
  httpBase: string;
  wsUrl: string;
};

/**
 * Resolve paired HTTP and WebSocket targets from any supported input scheme:
 * `http://`, `https://`, `ws://`, or `wss://`.
 *
 * HTTP(S) inputs preserve their pathname for `httpBase` and use `/ws` for the
 * socket path. WS(S) inputs preserve their socket pathname and expose the HTTP
 * origin as `httpBase`.
 */
export function resolveHttpWebSocketTargets(baseUrl: string): HttpWebSocketTargets {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  const url = new URL(trimmed);

  let httpProtocol: "http:" | "https:";
  let wsProtocol: "ws:" | "wss:";
  switch (url.protocol) {
    case "http:":
      httpProtocol = "http:";
      wsProtocol = "ws:";
      break;
    case "https:":
      httpProtocol = "https:";
      wsProtocol = "wss:";
      break;
    case "ws:":
      httpProtocol = "http:";
      wsProtocol = "ws:";
      break;
    case "wss:":
      httpProtocol = "https:";
      wsProtocol = "wss:";
      break;
    default:
      throw new Error(
        `resolveHttpWebSocketTargets: unsupported scheme "${url.protocol.replace(/:$/u, "")}". Expected one of http, https, ws, wss.`,
      );
  }

  const pathname =
    url.pathname === "/" ? "" : url.pathname.replace(/\/+$/u, "");
  const explicitWsInput = url.protocol === "ws:" || url.protocol === "wss:";
  const httpBase = `${httpProtocol}//${url.host}${explicitWsInput ? "" : pathname}`;
  const wsPath = explicitWsInput ? pathname || "/ws" : "/ws";
  const wsUrl = `${wsProtocol}//${url.host}${wsPath}`;
  return {
    httpBase,
    wsUrl,
  };
}

/**
 * Safe variant of {@link resolveHttpWebSocketTargets}; returns null for empty,
 * malformed, or unsupported values.
 */
export function tryResolveHttpWebSocketTargets(
  baseUrl: string,
): HttpWebSocketTargets | null {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  if (!trimmed) {
    return null;
  }
  try {
    return resolveHttpWebSocketTargets(trimmed);
  } catch {
    return null;
  }
}

export const resolveGatewayTargets = resolveHttpWebSocketTargets;
export const tryResolveGatewayTargets = tryResolveHttpWebSocketTargets;

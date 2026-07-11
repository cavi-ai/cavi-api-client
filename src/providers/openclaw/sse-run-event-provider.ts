import {
  GatewaySseRunEventProvider,
  type GatewaySseRunEventProviderOptions,
} from "../../core/gateway/run/sse-run-event-provider.js";
import type {
  RunEventStreamHandlers,
  RunEventStreamSubscribeParams,
  RunEventStreamSubscription,
} from "../../core/gateway/run/event-stream.js";
import { GATEWAY_API_ENDPOINTS } from "../../contracts/paths.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";

export type OpenClawSseRunEventProviderOptions = GatewaySseRunEventProviderOptions;

export class OpenClawSseRunEventProvider extends GatewaySseRunEventProvider {
  constructor(options: OpenClawSseRunEventProviderOptions) {
    super({
      ...options,
      endpoints: options.endpoints ?? GATEWAY_API_ENDPOINTS,
    });
  }

  override async subscribe(
    _params: RunEventStreamSubscribeParams,
    handlers: RunEventStreamHandlers,
  ): Promise<RunEventStreamSubscription> {
    const error = new ApiClientError(
      "OpenClaw run events are WebSocket JSON-RPC event frames; use createGatewayWebSocketClient(...).onEvent(...) instead of SSE.",
      { code: ApiClientErrorCode.EndpointNotFound },
    );
    const notify = () => handlers.onError?.(error);
    if (typeof queueMicrotask === "function") {
      queueMicrotask(notify);
    } else {
      void Promise.resolve().then(notify);
    }
    return { dispose: () => undefined };
  }
}

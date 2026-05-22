import { HERMES_API_ENDPOINTS } from "../../contracts/paths.js";
import {
  GatewaySseRunEventProvider as CoreGatewaySseRunEventProvider,
  type GatewaySseRunEventHeaderResolver,
  type GatewaySseRunEventProviderOptions,
} from "../../core/gateway/run/sse-run-event-provider.js";

export type HermesSseRunEventProviderOptions = GatewaySseRunEventProviderOptions & {
  /** Required for `X-Hermes-Session-Key` on both the SSE request and the poll fallback. */
  sessionKey: string;
};
export type {
  GatewaySseRunEventHeaderResolver,
  GatewaySseRunEventProviderOptions,
};

/**
 * Subscribes to the Hermes run-event SSE stream and emits
 * canonical run-stream events. Falls back to status polling
 * when SSE is unsupported by the server.
 *
 * The caller is responsible for starting the run and
 * supplying the resulting `run_id` to {@link subscribe}.
 *
 * Tool events are emitted when the underlying Hermes payload contains
 * tool-shaped fields (`tool_name`, `function_name`, etc.). When the Hermes API
 * does not natively emit tool events, compose this provider with
 * {@link RunPreviewPollProvider} via `createRunStreamWithToolFallback`.
 */
export class HermesSseRunEventProvider extends CoreGatewaySseRunEventProvider {
  constructor(options: HermesSseRunEventProviderOptions) {
    const sessionKey = options.sessionKey.trim();
    if (!sessionKey) {
      throw new Error("HermesSseRunEventProvider requires sessionKey");
    }
    super({
      ...options,
      endpoints: options.endpoints ?? HERMES_API_ENDPOINTS,
      resolveHeaders: (params) => ({
        ...(options.resolveHeaders?.(params) ?? {}),
        "X-Hermes-Session-Key": sessionKey,
      }),
    });
  }
}

export const GatewaySseRunEventProvider = CoreGatewaySseRunEventProvider;

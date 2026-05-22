import {
  GatewaySseRunEventProvider,
  type GatewaySseRunEventProviderOptions,
} from "../../core/gateway/run/sse-run-event-provider.js";
import { GATEWAY_API_ENDPOINTS } from "../../contracts/paths.js";

export type OpenClawSseRunEventProviderOptions = GatewaySseRunEventProviderOptions;

export class OpenClawSseRunEventProvider extends GatewaySseRunEventProvider {
  constructor(options: OpenClawSseRunEventProviderOptions) {
    super({
      ...options,
      endpoints: options.endpoints ?? GATEWAY_API_ENDPOINTS,
    });
  }
}

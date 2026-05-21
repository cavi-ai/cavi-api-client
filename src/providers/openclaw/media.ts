import { GatewayMediaApiClient } from "../../core/gateway/media.js";
import { OPENCLAW_MEDIA_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export class OpenClawMediaApiClient extends GatewayMediaApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, {
      endpoints: OPENCLAW_MEDIA_API_ENDPOINTS,
      surface: "openclaw-media-api",
    });
  }
}

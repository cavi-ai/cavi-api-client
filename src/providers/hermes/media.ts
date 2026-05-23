import { GatewayMediaApiClient } from "../../core/gateway/resources/media.js";
import { HERMES_MEDIA_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export class HermesMediaApiClient extends GatewayMediaApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, {
      endpoints: HERMES_MEDIA_API_ENDPOINTS,
      surface: "hermes-media-api",
    });
  }
}

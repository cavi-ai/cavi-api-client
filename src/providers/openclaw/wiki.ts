import { GatewayWikiApiClient } from "../../core/gateway/resources/wiki.js";
import { OPENCLAW_WIKI_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export class OpenClawWikiApiClient extends GatewayWikiApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, {
      endpoints: OPENCLAW_WIKI_API_ENDPOINTS,
      surface: "openclaw-wiki-api",
    });
  }
}

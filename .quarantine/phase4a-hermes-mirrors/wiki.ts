import { GatewayWikiApiClient } from "../../core/gateway/resources/wiki.js";
import { HERMES_WIKI_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";

export class HermesWikiApiClient extends GatewayWikiApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, {
      endpoints: HERMES_WIKI_API_ENDPOINTS,
      surface: "hermes-wiki-api",
    });
  }
}

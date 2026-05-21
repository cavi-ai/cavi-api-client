import { BaseHttpApiClient } from "./base-client.js";
import { appendHttpQuery, LIBRARY_API_ENDPOINTS } from "./paths.js";
import type { HttpApiClientOptions, HttpApiTransport } from "./types.js";

export type LibraryIngestSource = {
  kind: "url" | "text" | "file" | "note";
  uri?: string;
  title?: string;
  text?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
};

export type LibraryIngestRequest = {
  source: LibraryIngestSource;
  workspaceId?: string;
  channelId?: string;
  threadId?: string;
  requestedBy?: string;
};

export type LibraryIngestResult = {
  accepted: boolean;
  id?: string;
  jobId?: string;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
};

export class LibraryApiClient extends BaseHttpApiClient {
  readonly endpoints = LIBRARY_API_ENDPOINTS;
  readonly request: HttpApiTransport;

  constructor(options: HttpApiClientOptions) {
    super("library-api", options);
    this.request = this.createTransport();
  }

  ingest(body: LibraryIngestRequest, idempotencyKey?: string): Promise<LibraryIngestResult> {
    return this.request<LibraryIngestResult>(this.endpoints.ingest, {
      method: "POST",
      body,
      idempotencyKey,
    });
  }

  search<T = unknown>(query: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(appendHttpQuery(this.endpoints.search, query));
  }

  getDocument<T = unknown>(id: string): Promise<T> {
    return this.request<T>(this.endpoints.document(id));
  }
}

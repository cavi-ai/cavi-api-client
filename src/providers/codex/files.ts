import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import { BaseHttpApiClient } from "../../core/http/client.js";
import { bearerCredentials } from "../../core/http/credentials.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import {
  CODEX_API_BASE_URL,
  CODEX_API_ENDPOINTS,
  codexFilePath,
  codexFileContentPath,
} from "./paths.js";

export type CodexFilesClientOptions = {
  /** OpenAI API key. Backend-owned. */
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
  defaultTimeoutMs?: number;
};

export type CodexFileObject = { id: string } & Record<string, unknown>;

/** Minimal OpenAI Files client (multipart upload + content download + retrieve/delete). */
export class CodexFilesClient extends BaseHttpApiClient {
  readonly request: HttpApiTransport;

  constructor(options: CodexFilesClientOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new ApiClientError("codex-files: an api key is required", {
        code: ApiClientErrorCode.ValidationFailed,
      });
    }
    super("codex-files", {
      baseUrl: options.baseUrl?.trim() || CODEX_API_BASE_URL,
      includePortalClientIdHeader: false,
      auth: { resolveHeaders: bearerCredentials(apiKey) },
      defaultTimeoutMs: options.defaultTimeoutMs,
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
  }

  /** Upload a file (multipart). `content` is the file text (e.g. batch input JSONL). */
  async uploadFile(content: string, purpose: string, filename = "batch.jsonl"): Promise<CodexFileObject> {
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", new Blob([content], { type: "application/jsonl" }), filename);
    // rawBody bypasses JSON serialization; with no `body` set, buildHeaders does NOT
    // force Content-Type, so fetch sets multipart/form-data with the boundary.
    const response = await this.requestRaw(CODEX_API_ENDPOINTS.files, { method: "POST", rawBody: form });
    return (await response.json()) as CodexFileObject;
  }

  /** Download raw file content (e.g. a batch output/error file's JSONL). */
  async downloadFileContent(fileId: string): Promise<string> {
    const response = await this.requestRaw(codexFileContentPath(fileId), { method: "GET" });
    return response.text();
  }

  retrieveFile(fileId: string): Promise<CodexFileObject> {
    return this.request<CodexFileObject>(codexFilePath(fileId));
  }

  deleteFile(fileId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(codexFilePath(fileId), { method: "DELETE" });
  }
}

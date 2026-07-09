import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import { BaseHttpApiClient } from "../../core/http/client.js";
import { apiKeyCredentials } from "../../core/http/credentials.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import {
  GEMINI_API_BASE_URL,
  GEMINI_FILES_UPLOAD_PATH,
  geminiFileDownloadPath,
  geminiFilePath,
} from "./paths.js";

export type GeminiFilesClientOptions = {
  /** Gemini Developer API (AI Studio) key. Keep backend-owned. */
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
  defaultTimeoutMs?: number;
};

export type GeminiFileObject = { name: string } & Record<string, unknown>;

function readUploadUrl(response: Response): string {
  const uploadUrl = response.headers.get("x-goog-upload-url") ?? response.headers.get("X-Goog-Upload-Url");
  if (!uploadUrl?.trim()) {
    throw new ApiClientError("gemini-files: resumable upload response missing x-goog-upload-url", {
      code: ApiClientErrorCode.RequestFailed,
    });
  }
  return uploadUrl.trim();
}

function readFileName(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string") return record.name;
    const file = record.file;
    if (file && typeof file === "object" && !Array.isArray(file) && typeof (file as { name?: unknown }).name === "string") {
      return (file as { name: string }).name;
    }
  }
  throw new ApiClientError("gemini-files: upload response missing file name", {
    code: ApiClientErrorCode.InvalidJson,
  });
}

/** Gemini Files API client (resumable upload + download). */
export class GeminiFilesClient extends BaseHttpApiClient {
  readonly request: HttpApiTransport;
  private readonly uploadFetch: typeof fetch;

  constructor(options: GeminiFilesClientOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new ApiClientError("gemini-files: an api key is required", {
        code: ApiClientErrorCode.ValidationFailed,
      });
    }
    super("gemini-files", {
      baseUrl: options.baseUrl?.trim() || GEMINI_API_BASE_URL,
      includePortalClientIdHeader: false,
      auth: { resolveHeaders: apiKeyCredentials(apiKey, { header: "x-goog-api-key" }) },
      defaultTimeoutMs: options.defaultTimeoutMs,
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.uploadFetch = options.fetchImpl ?? fetch;
  }

  /** Upload text content via Google's resumable upload protocol. */
  async uploadFile(
    content: string,
    options: { displayName?: string; mimeType?: string } = {},
  ): Promise<GeminiFileObject> {
    const bytes = new TextEncoder().encode(content);
    const mimeType = options.mimeType ?? "application/jsonl";
    const displayName = options.displayName ?? "batch-input.jsonl";
    const start = await this.requestRaw(GEMINI_FILES_UPLOAD_PATH, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: { file: { display_name: displayName } },
    });
    const uploadUrl = readUploadUrl(start);
    const upload = await this.uploadFetch(uploadUrl, {
      method: "POST",
      headers: {
        ...this.buildHeaders({ method: "POST" }),
        "Content-Length": String(bytes.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: bytes,
    });
    if (!upload.ok) {
      const body = await upload.text();
      throw new ApiClientError(`gemini-files: upload failed (${upload.status})`, {
        code: ApiClientErrorCode.RequestFailed,
        cause: body,
      });
    }
    const payload = (await upload.json()) as unknown;
    return { name: readFileName(payload) };
  }

  /** Download raw file content (batch output JSONL). */
  async downloadFile(fileName: string): Promise<string> {
    const response = await this.requestRaw(geminiFileDownloadPath(fileName), { method: "GET" });
    return response.text();
  }

  retrieveFile(fileName: string): Promise<GeminiFileObject> {
    return this.request<GeminiFileObject>(geminiFilePath(fileName));
  }

  deleteFile(fileName: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(geminiFilePath(fileName), { method: "DELETE" });
  }
}

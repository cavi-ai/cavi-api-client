import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import { HttpApiError } from "../../core/http/errors.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { buildDryRunStatus } from "../../core/runtime/dry-run.js";
import { OpenCodeApiClient, type OpenCodeApiClientOptions } from "./client.js";
import { buildOpenCodePromptBody } from "./request.js";
import { encodeOpenCodeSessionId } from "./protocol.js";
import { OPENCODE_V2_SESSIONS_PATH, openCodeV2MessagesPath, openCodeV2SessionPath } from "./v2-paths.js";

/** OpenCode v2 uses location-scoped sessions. The v1 workspace selector is unsupported. */
export type OpenCodeV2ApiClientOptions = Omit<OpenCodeApiClientOptions, "scope"> & {
  scope: { directory: string };
};

function protocolError(): ApiClientError {
  return new ApiClientError("opencode v2: invalid session response or pagination limit exceeded", {
    code: ApiClientErrorCode.TransportProtocolError,
  });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw protocolError();
  return value as Record<string, unknown>;
}

/** Polling lifecycle for the v2 HTTP API; deliberately does not advertise v1 SSE support. */
export class OpenCodeV2ApiClient implements RuntimeClient {
  // Reuse the existing authenticated, redacted HTTP transport, without invoking
  // any legacy health, route, or lifecycle methods.
  private readonly http: OpenCodeApiClient;
  private readonly options: OpenCodeV2ApiClientOptions;

  constructor(options: OpenCodeV2ApiClientOptions) {
    if ((options?.scope as { workspace?: unknown } | undefined)?.workspace !== undefined) {
      throw new ApiClientError("opencode v2: workspace is unsupported", { code: ApiClientErrorCode.InvalidConfig });
    }
    this.http = new OpenCodeApiClient(options);
    this.options = { ...options };
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    const capabilities = await this.http.getRuntimeCapabilities();
    return { ...capabilities, protocolVersion: "2", supports: { ...capabilities.supports, streaming: false } };
  }

  private session(value: unknown, expected?: string): Record<string, unknown> {
    const data = record(record(value).data);
    if (typeof data.id !== "string" || !data.id.startsWith("ses_") || (expected !== undefined && data.id !== expected) ||
        record(data.location).directory !== this.http.scope.directory) throw protocolError();
    try { encodeOpenCodeSessionId(data.id); } catch { throw protocolError(); }
    return data;
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const payload = buildOpenCodePromptBody(body, this.options.defaultModel);
    if (payload.system) {
      throw new ApiClientError("opencode v2: configure instructions on the server agent", { code: ApiClientErrorCode.ValidationFailed });
    }
    if (body.dryRun) return buildDryRunStatus(body.model ?? this.options.defaultModel);
    const data = this.session(await this.http.request<unknown>(OPENCODE_V2_SESSIONS_PATH, {
      method: "POST", body: {
        location: { directory: this.http.scope.directory },
        ...(payload.model ? { model: { providerID: payload.model.providerID, id: payload.model.modelID } } : {}),
      },
    }));
    const id = data.id as string;
    try {
      const accepted = record(record(await this.http.request<unknown>(openCodeV2SessionPath(id, "prompt"), {
        method: "POST", body: { text: payload.parts[0].text, resume: true },
      })).data);
      if (accepted.sessionID !== id || accepted.type !== "user" || typeof accepted.id !== "string") throw protocolError();
      return { run_id: id, status: "started" };
    } catch (error) {
      await this.cancelRun(id).catch(() => undefined);
      throw error;
    }
  }

  async getRun(runId: string): Promise<RuntimeRunStatus> {
    const signal = AbortSignal.timeout(this.options.defaultTimeoutMs ?? 60_000);
    let data: Record<string, unknown>;
    try {
      data = this.session(await this.http.request<unknown>(openCodeV2SessionPath(runId), { method: "GET", signal }), runId);
    } catch (error) {
      if (error instanceof HttpApiError && error.status === 404) return { run_id: runId, status: "unknown" };
      throw error;
    }
    const outcome = data.outcome;
    const status = outcome === "succeeded" ? "completed" : outcome === "failed" ? "failed" : outcome === "interrupted" ? "cancelled" : outcome === undefined ? "running" : undefined;
    if (!status) throw protocolError();
    const result: RuntimeRunStatus = { run_id: runId, status };
    if (status !== "completed") return status === "failed" ? { ...result, error: "OpenCode run failed" } : result;
    let cursor: string | undefined;
    const seen = new Set<string>();
    let bytes = 0;
    for (let page = 0; page < 100; page++) {
      const response = record(await this.http.request<unknown>(openCodeV2MessagesPath(runId, cursor), { method: "GET", signal }));
      if (!Array.isArray(response.data)) throw protocolError();
      for (const item of response.data) {
        const message = record(item);
        if (message.type !== "assistant") continue;
        if (!Array.isArray(message.content)) throw protocolError();
        let text = "";
        for (const part of message.content) {
          const content = record(part);
          if (content.type === "text") {
            if (typeof content.text !== "string") throw protocolError();
            bytes += new TextEncoder().encode(content.text).length;
            if (bytes > 1_048_576) throw protocolError();
            text += content.text;
          }
        }
        result.output = text;
      }
      const next = record(response.cursor).next;
      if (next === null || next === undefined) return result;
      if (typeof next !== "string" || !next || seen.has(next)) throw protocolError();
      seen.add(next);
      cursor = next;
    }
    throw protocolError();
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    const response = record(await this.http.request<unknown>(openCodeV2SessionPath(runId, "interrupt"), { method: "POST" }));
    if (typeof response.interrupted !== "boolean") throw protocolError();
    return { status: response.interrupted ? "cancelled" : "unknown" };
  }
}

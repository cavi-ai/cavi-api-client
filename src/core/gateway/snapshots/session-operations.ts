import { GATEWAY_SESSION_API_PATHS } from "../../../contracts/paths.js";

import type { GatewayRpcClient } from "../rpc/client.js";
import type {
  SessionDetailPayload,
  SessionDetailRequestParams,
  SessionHttpRequestJson,
  SessionPatchInput,
  SessionsListRequestParams,
  SessionsListRpcPayload,
  SessionsPreviewRequestParams,
} from "./session-loaders.js";
import type {
  SessionsPreviewPayload,
  SessionsUsagePayload,
} from "./transforms.js";

export type GatewaySessionRequestOptions = {
  signal?: AbortSignal;
};

export interface GatewaySessionOperations {
  list(
    input: SessionsListRequestParams,
    options?: GatewaySessionRequestOptions,
  ): Promise<SessionsListRpcPayload>;
  usage(
    input: Record<string, unknown>,
    options?: GatewaySessionRequestOptions,
  ): Promise<SessionsUsagePayload>;
  preview(
    input: SessionsPreviewRequestParams,
    options?: GatewaySessionRequestOptions,
  ): Promise<SessionsPreviewPayload>;
  detail(
    input: SessionDetailRequestParams,
    options?: GatewaySessionRequestOptions,
  ): Promise<SessionDetailPayload>;
  patch(
    input: SessionPatchInput,
    options?: GatewaySessionRequestOptions,
  ): Promise<void>;
}

function withQuery(path: string, params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== undefined && entry !== null) {
          query.append(key, String(entry));
        }
      }
      continue;
    }
    query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

function requireTransport(
  client: GatewayRpcClient | null | undefined,
  requestJson: SessionHttpRequestJson | null,
): void {
  if (!client && !requestJson) {
    throw new Error("Gateway client not connected");
  }
}

export function createOpenClawSessionOperations(
  client: GatewayRpcClient | null | undefined,
  requestJson: SessionHttpRequestJson | null = null,
): GatewaySessionOperations {
  return {
    async list(input) {
      requireTransport(client, requestJson);
      if (client) {
        return await client.request<SessionsListRpcPayload>(
          "sessions.list",
          input,
        );
      }
      return await requestJson!<SessionsListRpcPayload>(
        withQuery(GATEWAY_SESSION_API_PATHS.list, input),
      );
    },
    async usage(input) {
      requireTransport(client, requestJson);
      if (client) {
        return await client.request<SessionsUsagePayload>(
          "sessions.usage",
          input,
        );
      }
      return await requestJson!<SessionsUsagePayload>(
        withQuery(GATEWAY_SESSION_API_PATHS.usage, input),
      );
    },
    async preview(input) {
      requireTransport(client, requestJson);
      if (client) {
        return await client.request<SessionsPreviewPayload>(
          "sessions.preview",
          input,
        );
      }
      return await requestJson!<SessionsPreviewPayload>(
        GATEWAY_SESSION_API_PATHS.preview,
        { method: "POST", body: input },
      );
    },
    async detail(input) {
      requireTransport(client, requestJson);
      if (client) {
        return await client.request<SessionDetailPayload>(
          "sessions.detail",
          input,
        );
      }
      return await requestJson!<SessionDetailPayload>(
        GATEWAY_SESSION_API_PATHS.detail,
        { method: "POST", body: input },
      );
    },
    async patch(input) {
      requireTransport(client, requestJson);
      if (client) {
        await client.request<unknown>("sessions.patch", input);
        return;
      }
      await requestJson!<unknown>(GATEWAY_SESSION_API_PATHS.patch, {
        method: "PATCH",
        body: input,
      });
    },
  };
}

import { describe, expect, it, vi } from "vitest";
import {
  RawHttpApiClient,
  createRawHttpApiClient,
  toHttpRequestInit,
} from "../../../core/http/raw-client";
import { REDACTION_PLACEHOLDER } from "../../../core/http/redaction";

describe("raw HTTP API client", () => {
  it("exposes raw responses while preserving BaseHttpApiClient headers", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("accepted", {
        status: 202,
        headers: { "Content-Type": "text/plain" },
      }),
    ) as typeof fetch;
    const client = new RawHttpApiClient("gateway-api", {
      baseUrl: "https://gateway.example",
      auth: {
        bearerToken: "token",
        clientId: "portal-client",
      },
      fetchImpl,
    });

    const response = await client.raw("/v1/raw");

    expect(await response.text()).toBe("accepted");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gateway.example/v1/raw",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer token",
          "X-Portal-Client-Id": "portal-client",
        }),
      }),
    );
  });

  it("creates relative-base clients for embedded runtimes", async () => {
    const client = createRawHttpApiClient({
      surface: "library-api",
      baseUrl: "",
      authToken: null,
      clientId: "portal-client",
    });

    expect(client.baseUrl).toBe("");
    expect(client.surface).toBe("library-api");
  });

  it("redacts secrets from trace payloads and error messages", async () => {
    const onTrace = vi.fn();
    const fetchImpl = vi.fn(async () =>
      new Response('{"api_key":"sk-live","message":"bad token=response-secret"}', {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;
    const client = new RawHttpApiClient("gateway-api", {
      baseUrl: "https://gateway.example",
      fetchImpl,
      onTrace,
    });

    await expect(
      client.raw("/v1/raw?token=query-secret"),
    ).rejects.toMatchObject({
      message: `GET /v1/raw?token=${REDACTION_PLACEHOLDER} failed with HTTP 401`,
      path: "/v1/raw?token=query-secret",
      url: "https://gateway.example/v1/raw?token=query-secret",
    });

    expect(onTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/v1/raw?token=${REDACTION_PLACEHOLDER}`,
        url: `https://gateway.example/v1/raw?token=${REDACTION_PLACEHOLDER}`,
        error: expect.stringContaining(`"api_key":"${REDACTION_PLACEHOLDER}"`),
      }),
    );
    const trace = onTrace.mock.calls[0]?.[0];
    expect(trace?.error).not.toContain("sk-live");
    expect(trace?.error).not.toContain("response-secret");
    expect(trace?.path).not.toContain("query-secret");
    expect(trace?.url).not.toContain("query-secret");
  });

  it("converts platform RequestInit into package HttpApiRequestInit", () => {
    const body = new FormData();
    const init = toHttpRequestInit(
      {
        method: "post",
        body,
        cache: "no-store",
        credentials: "same-origin",
      },
      { Accept: "application/json" },
    );

    expect(init).toEqual({
      method: "POST",
      headers: { Accept: "application/json" },
      rawBody: body,
      signal: undefined,
      cache: "no-store",
      credentials: "same-origin",
    });
  });
});

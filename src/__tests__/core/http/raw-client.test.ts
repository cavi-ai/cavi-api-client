import { describe, expect, it, vi } from "vitest";
import {
  RawHttpApiClient,
  createRawHttpApiClient,
  toHttpRequestInit,
} from "../../../core/http/raw-client";

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

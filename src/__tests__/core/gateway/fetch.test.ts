import { describe, expect, it } from "vitest";
import {
  buildGatewayAuthHeaders,
  fetchGatewayExpectOk,
  fetchGatewayJson,
  resolveGatewayRequestCredentials,
} from "../../../core/gateway/client/fetch";
import { PORTAL_CLIENT_ID_HEADER } from "../../../core/http/client-id";

describe("gateway fetch helpers", () => {
  it("builds gateway auth headers without hardcoding a provider", () => {
    expect(buildGatewayAuthHeaders("client-1", "token-1")).toEqual({
      Accept: "application/json",
      [PORTAL_CLIENT_ID_HEADER]: "client-1",
      Authorization: "Bearer token-1",
    });
    expect(
      buildGatewayAuthHeaders("client-1", "token-1", {
        includeBearerToken: false,
      }),
    ).toEqual({
      Accept: "application/json",
      [PORTAL_CLIENT_ID_HEADER]: "client-1",
    });
  });

  it("uses the core raw HTTP client for gateway JSON fetches", async () => {
    let request:
      | {
          input: RequestInfo | URL;
          init?: RequestInit;
        }
      | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const payload = await fetchGatewayJson<{ ok: boolean }>(
      "/v1/capabilities",
      {
        httpBaseUrl: "https://gateway.example",
        clientId: "client-1",
        authToken: "token-1",
        apiLabel: "Gateway API",
        fetchImpl,
      },
    );

    expect(payload).toEqual({ ok: true });
    expect(String(request?.input)).toBe("https://gateway.example/v1/capabilities");
    expect(request?.init?.headers).toMatchObject({
      Accept: "application/json",
      [PORTAL_CLIENT_ID_HEADER]: "client-1",
      Authorization: "Bearer token-1",
    });
  });

  it("uses session credentials without a bearer header when requested", async () => {
    let request:
      | {
          init?: RequestInit;
        }
      | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      request = { init };
      return new Response(null, { status: 204 });
    };

    await fetchGatewayExpectOk("/health", {
      httpBaseUrl: "https://gateway.example",
      clientId: "client-1",
      authToken: "token-1",
      apiLabel: "Gateway API",
      sessionAuthMode: true,
      fetchImpl,
    });

    expect(resolveGatewayRequestCredentials(true)).toBe("same-origin");
    expect(request?.init?.credentials).toBe("same-origin");
    expect(request?.init?.headers).toMatchObject({
      Accept: "application/json",
      [PORTAL_CLIENT_ID_HEADER]: "client-1",
    });
    expect(request?.init?.headers).not.toMatchObject({
      Authorization: "Bearer token-1",
    });
  });
});

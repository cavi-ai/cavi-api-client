import { describe, expect, it } from "vitest";
import { BaseHttpApiClient } from "../../../core/http/client";
import { apiKeyCredentials } from "../../../core/http/credentials";
import type { HttpApiClientOptions, HttpApiRequestInit } from "../../../core/http/types";

// Expose the protected header builder for assertion.
class TestClient extends BaseHttpApiClient {
  headers(init?: HttpApiRequestInit) {
    return this.buildHeaders(init);
  }
}

const make = (options: Partial<HttpApiClientOptions>) =>
  new TestClient("gateway", { baseUrl: "https://api.example", ...options });

describe("auth.resolveHeaders credential seam", () => {
  it("falls back to bearer when no resolver is supplied (unchanged default)", () => {
    const headers = make({ auth: { bearerToken: "tok" } }).headers();
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("uses the resolver's headers when supplied (Anthropic shape)", () => {
    const headers = make({
      auth: {
        resolveHeaders: apiKeyCredentials("sk-abc", {
          header: "x-api-key",
          extra: { "anthropic-version": "2023-06-01" },
        }),
      },
    }).headers();
    expect(headers["x-api-key"]).toBe("sk-abc");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers.Authorization).toBeUndefined();
  });

  it("resolver takes precedence over a bearer token if both are present", () => {
    const headers = make({
      auth: {
        bearerToken: "tok",
        resolveHeaders: apiKeyCredentials("sk", { header: "x-api-key" }),
      },
    }).headers();
    expect(headers["x-api-key"]).toBe("sk");
    expect(headers.Authorization).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  apiKeyCredentials,
  bearerCredentials,
} from "../../../core/http/credentials";

describe("credential resolvers", () => {
  it("bearerCredentials emits an Authorization header", () => {
    expect(bearerCredentials("tok-123")()).toEqual({ Authorization: "Bearer tok-123" });
  });

  it("bearerCredentials emits nothing for an empty token", () => {
    expect(bearerCredentials("")()).toEqual({});
    expect(bearerCredentials(null)()).toEqual({});
  });

  it("apiKeyCredentials emits the key header plus any extras (Anthropic shape)", () => {
    const resolve = apiKeyCredentials("sk-abc", {
      header: "x-api-key",
      extra: { "anthropic-version": "2023-06-01" },
    });
    expect(resolve()).toEqual({
      "x-api-key": "sk-abc",
      "anthropic-version": "2023-06-01",
    });
  });

  it("apiKeyCredentials defaults the header name to Authorization", () => {
    expect(apiKeyCredentials("sk-abc")()).toEqual({ Authorization: "sk-abc" });
  });
});

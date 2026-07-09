import { describe, expect, it } from "vitest";
import {
  extractGatewayErrorDetails,
  formatGatewayHttpErrorMessage,
  parseGatewayErrorText,
} from "../../../core/gateway/client/error-details";
import { REDACTION_PLACEHOLDER } from "../../../core/http/redaction";

describe("gateway error details", () => {
  it("extracts nested gateway error messages and codes", () => {
    expect(
      extractGatewayErrorDetails({
        error: {
          message: " route unavailable ",
          code: " not_found ",
        },
      }),
    ).toEqual({
      message: "route unavailable",
      code: "not_found",
    });
  });

  it("accepts string error fields as messages", () => {
    expect(extractGatewayErrorDetails({ error: "offline" })).toEqual({
      message: "offline",
      code: null,
    });
  });

  it("parses JSON error text only for JSON content types", () => {
    expect(
      parseGatewayErrorText(
        JSON.stringify({ message: "bad request", code: "bad_request" }),
        "application/json; charset=utf-8",
      ),
    ).toEqual({
      message: "bad request",
      code: "bad_request",
    });
    expect(parseGatewayErrorText("bad request", "text/plain")).toEqual({
      message: null,
      code: null,
    });
  });

  it("formats gateway HTTP errors consistently", () => {
    expect(
      formatGatewayHttpErrorMessage({
        label: "Gateway API",
        status: 404,
        statusText: "Not Found",
        message: "route unavailable",
        code: "not_found",
      }),
    ).toBe("Gateway API 404: Not Found [not_found] - route unavailable");
  });

  it("redacts secrets in formatted gateway HTTP errors", () => {
    const message = formatGatewayHttpErrorMessage({
      label: "Gateway API?token=query-secret",
      status: 401,
      statusText: "Unauthorized token=status-secret",
      message: "api_key=sk-live",
      code: "secret=code-secret",
    });

    expect(message).toContain(`token=${REDACTION_PLACEHOLDER}`);
    expect(message).toContain(`api_key=${REDACTION_PLACEHOLDER}`);
    expect(message).toContain(`secret=${REDACTION_PLACEHOLDER}`);
    expect(message).not.toMatch(/query-secret|status-secret|sk-live|code-secret/u);
  });
});

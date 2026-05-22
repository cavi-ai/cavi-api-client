import { describe, expect, it } from "vitest";
import {
  extractGatewayErrorDetails,
  formatGatewayHttpErrorMessage,
  parseGatewayErrorText,
} from "../../../core/gateway/error-details";

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
});

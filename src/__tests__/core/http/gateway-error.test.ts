import { describe, expect, it } from "vitest";
import {
  GatewayHttpError,
  buildGatewayHttpError,
} from "../../../core/http/gateway-error";

describe("gateway HTTP errors", () => {
  it("uses the generic gateway error class with gateway error formatting", () => {
    const error = buildGatewayHttpError({
      label: "Cavi Control API",
      status: 502,
      statusText: "Bad Gateway",
      message: "plugin offline",
      code: "plugin_offline",
    });

    expect(error).toBeInstanceOf(GatewayHttpError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("plugin_offline");
    expect(error.message).toBe(
      "Cavi Control API 502: Bad Gateway [plugin_offline] - plugin offline",
    );
  });
});

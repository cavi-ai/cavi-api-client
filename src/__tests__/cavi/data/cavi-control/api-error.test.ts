import { describe, expect, it } from "vitest";
import {
  CaviControlApiError,
  buildGatewayHttpError,
} from "../../../../cavi/data/cavi-control/api-error";

describe("CAVI control API errors", () => {
  it("keeps the CAVI error class while using core gateway error formatting", () => {
    const error = buildGatewayHttpError({
      label: "Cavi Control API",
      status: 502,
      statusText: "Bad Gateway",
      message: "plugin offline",
      code: "plugin_offline",
    });

    expect(error).toBeInstanceOf(CaviControlApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("plugin_offline");
    expect(error.message).toBe(
      "Cavi Control API 502: Bad Gateway [plugin_offline] - plugin offline",
    );
  });
});

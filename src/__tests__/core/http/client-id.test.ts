import { describe, expect, it } from "vitest";
import {
  isValidPortalClientId,
  normalizePortalClientId,
  requirePortalClientId,
} from "../../../core/http/client-id";

describe("portal client id", () => {
  it("normalizes valid client ids to lowercase slugs", () => {
    expect(normalizePortalClientId(" Portal.Client_1 ")).toBe("portal.client_1");
    expect(requirePortalClientId(" Portal.Client_1 ")).toBe("portal.client_1");
  });

  it("rejects missing or invalid client ids", () => {
    expect(normalizePortalClientId("bad value")).toBeNull();
    expect(isValidPortalClientId("bad value")).toBe(false);
    expect(() => requirePortalClientId("bad value")).toThrow(
      /lowercase slug/u,
    );
    expect(() => requirePortalClientId("")).toThrow(/Missing clientId/u);
  });
});

import { describe, expect, it } from "vitest";
import { ApiClientErrorCode, getErrorCode } from "../../../core/errors";
import {
  assertProtocolVersion,
  checkProtocolVersion,
} from "../../../core/runtime/protocol";

describe("protocol version guard", () => {
  it("reports a match", () => {
    const result = checkProtocolVersion({ protocolVersion: "v4" }, "v4");
    expect(result.ok).toBe(true);
    expect(result.actual).toBe("v4");
  });

  it("reports a mismatch with both versions", () => {
    const result = checkProtocolVersion({ protocolVersion: "v3" }, "v4");
    expect(result.ok).toBe(false);
    expect(result.expected).toBe("v4");
    expect(result.actual).toBe("v3");
  });

  it("treats an absent reported version as unknown (not ok)", () => {
    expect(checkProtocolVersion({}, "v4").ok).toBe(false);
    expect(checkProtocolVersion({ protocolVersion: null }, "v4").actual).toBeNull();
  });

  it("assertProtocolVersion throws ProtocolMismatch-coded error on mismatch", () => {
    try {
      assertProtocolVersion({ protocolVersion: "v3" }, "v4");
      throw new Error("should have thrown");
    } catch (error) {
      expect(getErrorCode(error)).toBe(ApiClientErrorCode.ProtocolMismatch);
    }
  });

  it("assertProtocolVersion is a no-op on match", () => {
    expect(() => assertProtocolVersion({ protocolVersion: "v4" }, "v4")).not.toThrow();
  });
});

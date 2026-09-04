import { describe, expect, it } from "vitest";
import { ApiClientError, ApiClientErrorCode } from "../../../core/errors";
import {
  OPENCODE_ENDPOINT_FAMILY,
  OPENCODE_OPENAPI_SHA256,
  OPENCODE_SERVER_VERSION,
  validateOpenCodeScope,
  encodeOpenCodeSessionId,
} from "../../../providers/opencode/protocol";

describe("OpenCode protocol lock", () => {
  it("locks the verified server and API family", () => {
    expect(OPENCODE_SERVER_VERSION).toBe("1.18.27");
    expect(OPENCODE_OPENAPI_SHA256).toBe("46db986090aae41846cd6dbe16225a1d883f0bbcb4c48814008d3f6ce140aa5c");
    expect(OPENCODE_ENDPOINT_FAMILY).toBe("legacy-http-sse");
  });

  it("accepts POSIX, Windows drive-absolute, and UNC directories", () => {
    expect(validateOpenCodeScope({ directory: "/workspace/project" }).directory).toBe("/workspace/project");
    expect(validateOpenCodeScope({ directory: "C:\\workspace\\project" }).directory).toBe("C:\\workspace\\project");
    expect(validateOpenCodeScope({ directory: "\\\\server\\share\\project" }).directory).toBe("\\\\server\\share\\project");
  });

  it("validates scope without normalizing the original values", () => {
    const scope = validateOpenCodeScope({ directory: " /workspace/project ", workspace: " workspace " });
    expect(scope).toEqual({ directory: " /workspace/project ", workspace: " workspace " });
  });

  it("rejects missing, blank, and relative directories", () => {
    for (const directory of [undefined, "", "   ", "workspace/project", "C:workspace\\project", "\\workspace\\project"]) {
      expect(() => validateOpenCodeScope({ directory })).toThrowError(ApiClientError);
      expect(() => validateOpenCodeScope({ directory })).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }),
      );
    }
  });

  it("rejects a supplied blank workspace", () => {
    for (const workspace of ["", "   ", "\t"]) {
      expect(() => validateOpenCodeScope({ directory: "/workspace/project", workspace })).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }),
      );
    }
  });

  it("requires session IDs to be nonblank and ses_-prefixed, then encodes them", () => {
    expect(encodeOpenCodeSessionId("ses_a/b c")).toBe("ses_a%2Fb%20c");
    for (const sessionId of [undefined, "", "   ", "session_1", " ses_1"]) {
      expect(() => encodeOpenCodeSessionId(sessionId)).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }),
      );
    }
  });
});

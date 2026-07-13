import { describe, expect, it } from "vitest";
import { ApiClientErrorCode, ApiClientErrorType, serializeError } from "../../../core/errors.js";
import {
  TransportError,
  getTransportErrorMetadata,
  resolveTransportHeaders,
} from "../../../core/transport/index.js";

describe("transport errors", () => {
  it("preserves only validated transport metadata", () => {
    const error = new TransportError("temporary", {
      metadata: {
        kind: "http",
        phase: "request",
        operation: "models.list",
        retryable: true,
        attempt: 1,
        status: 503,
        code: "busy",
        retryAfterMs: 20,
      },
      cause: new Error("secret bearer token"),
    });

    expect(error).toMatchObject({
      name: "TransportError",
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.TransportUnavailable,
    });
    expect(getTransportErrorMetadata(error)).toEqual(error.transport);
    expect(serializeError(error)).toEqual({
      name: "TransportError",
      message: "temporary",
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.TransportUnavailable,
    });
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("redacts sensitive values from the public transport error message", () => {
    const error = new TransportError(
      "Authorization: Bearer abc.secret payload={token:top-secret} password=hunter2",
      {
        metadata: {
          kind: "http", phase: "request", operation: "models.list", retryable: false, attempt: 1,
        },
      },
    );

    const serialized = JSON.stringify(serializeError(error));
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("abc.secret");
    expect(serialized).not.toContain("top-secret");
    expect(serialized).not.toContain("hunter2");
  });

  it("rejects malformed transport metadata field by field", () => {
    expect(getTransportErrorMetadata({ transport: { kind: "http" } })).toBeUndefined();
    expect(getTransportErrorMetadata({ transport: {
      kind: "ftp", phase: "request", operation: "x", retryable: true, attempt: 1,
    } })).toBeUndefined();
    expect(getTransportErrorMetadata({ transport: {
      kind: "http", phase: "request", operation: " ", retryable: true, attempt: 1,
    } })).toBeUndefined();
    expect(getTransportErrorMetadata({ transport: {
      kind: "http", phase: "request", operation: "x", retryable: true, attempt: 0,
    } })).toBeUndefined();
    expect(getTransportErrorMetadata({ transport: {
      kind: "http", phase: "request", operation: "x", retryable: true, attempt: 1,
      retryAfterMs: -1,
    } })).toBeUndefined();
  });

  it("merges fresh auth headers without retaining resolver output", async () => {
    const resolverHeaders = { Authorization: "Bearer secret", Accept: "auth" };
    const headers = await resolveTransportHeaders({ Accept: "default", "X-App": "cavi" }, async () => ({
      headers: resolverHeaders,
    }));

    resolverHeaders.Authorization = "changed";
    expect(headers).toEqual({ Accept: "auth", "X-App": "cavi", Authorization: "Bearer secret" });
    expect(headers).not.toBe(resolverHeaders);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  abortError,
  invalidConfigError,
  invalidInputError,
  invalidJsonError,
  notConnectedError,
  protocolError,
} from "../../core/error-factories";
import {
  ApiClientErrorCode,
  ApiClientErrorType,
  getErrorCode,
  getErrorType,
  isAbortError,
  isApiClientError,
} from "../../core/errors";
import { assertSafeRelativePath } from "../../contracts/paths";
import { resolvePortalApiPath } from "../../extensions/cavi/contracts/paths";
import { requirePortalClientId } from "../../core/http/client-id";
import { JsonHttpApiClient } from "../../core/http/json-client";
import { fetchGatewayJson } from "../../core/gateway/client/fetch";
import { GatewayMediaApiClient } from "../../core/gateway/resources/media";
import { createCapabilityClient } from "../../contracts/capability-client";
import type { RuntimeClient } from "../../core/runtime/client";

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}

function expectTyped(error: unknown, type: string, code: string): void {
  expect(isApiClientError(error)).toBe(true);
  expect(getErrorType(error)).toBe(type);
  expect(getErrorCode(error)).toBe(code);
}

describe("error factories", () => {
  it.each([
    ["invalidInputError", invalidInputError("x"), ApiClientErrorType.Validation, ApiClientErrorCode.ValidationFailed],
    ["invalidConfigError", invalidConfigError("x"), ApiClientErrorType.Configuration, ApiClientErrorCode.InvalidConfig],
    ["protocolError", protocolError(ApiClientErrorType.Http, "x"), ApiClientErrorType.Http, ApiClientErrorCode.ProtocolMismatch],
    ["invalidJsonError", invalidJsonError(ApiClientErrorType.Http, "x"), ApiClientErrorType.Http, ApiClientErrorCode.InvalidJson],
    ["notConnectedError", notConnectedError("x"), ApiClientErrorType.Transport, ApiClientErrorCode.SocketUnavailable],
    ["abortError", abortError(), ApiClientErrorType.Abort, ApiClientErrorCode.Aborted],
  ])("%s sets type and code", (_name, error, type, code) => {
    expectTyped(error, type, code);
  });

  it("keeps the AbortError name on aborts", () => {
    const error = abortError();
    expect(error.name).toBe("AbortError");
    expect(error.message).toBe("The operation was aborted");
    expect(isAbortError(error)).toBe(true);
  });
});

describe("typed errors at call sites", () => {
  it("rejects unsafe relative paths as invalid input", () => {
    expectTyped(
      caught(() => assertSafeRelativePath("../escape")),
      ApiClientErrorType.Validation,
      ApiClientErrorCode.ValidationFailed,
    );
  });

  it("rejects a missing portal id as invalid input", () => {
    expectTyped(
      caught(() => resolvePortalApiPath("  ", "status")),
      ApiClientErrorType.Validation,
      ApiClientErrorCode.ValidationFailed,
    );
  });

  it("rejects a missing client id as invalid config", () => {
    expectTyped(
      caught(() => requirePortalClientId(null)),
      ApiClientErrorType.Configuration,
      ApiClientErrorCode.InvalidConfig,
    );
  });

  it("rejects a missing baseUrl as invalid config", () => {
    expectTyped(
      caught(() => new JsonHttpApiClient("test-surface", { baseUrl: "  " })),
      ApiClientErrorType.Configuration,
      ApiClientErrorCode.InvalidConfig,
    );
  });

  it("reports a non-JSON gateway response as a protocol mismatch", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } }));
    expectTyped(
      await rejected(() => fetchGatewayJson("/api/x", {
        httpBaseUrl: "https://gateway.example",
        clientId: "cavi-api-client",
        authToken: null,
        apiLabel: "Gateway API",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })),
      ApiClientErrorType.Http,
      ApiClientErrorCode.ProtocolMismatch,
    );
  });

  it("reports an unparseable gateway JSON body as invalid JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("{nope", { status: 200, headers: { "content-type": "application/json" } }));
    expectTyped(
      await rejected(() => fetchGatewayJson("/api/x", {
        httpBaseUrl: "https://gateway.example",
        clientId: "cavi-api-client",
        authToken: null,
        apiLabel: "Gateway API",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })),
      ApiClientErrorType.Http,
      ApiClientErrorCode.InvalidJson,
    );
  });
});

describe("capability facade with typed caller-input errors", () => {
  const runtime: RuntimeClient = {
    getRuntimeCapabilities: async () => ({ providerKind: "test", supports: { runs: true } }),
    startRun: async () => ({ run_id: "run-1", status: "started" }),
  };

  it("resolves invalid media input as a request-invalid gap without a request", async () => {
    const fetchImpl = vi.fn();
    const media = new GatewayMediaApiClient({
      baseUrl: "https://gateway.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const client = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { media: true },
      backends: { media },
    });

    const result = await client.media.listMediaProviders("hologram" as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.gap.reason).toBe("request-invalid");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

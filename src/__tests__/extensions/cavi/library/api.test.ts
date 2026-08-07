import { afterEach, describe, expect, it, vi } from "vitest";
import { REDACTION_PLACEHOLDER } from "../../../../core/http/redaction";
import { fetchLibraryApiJson } from "../../../../extensions/cavi/library/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLibraryApiJson", () => {
  it("redacts and bounds non-JSON gateway error bodies", async () => {
    const secret = "library-secret-value";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `upstream failed api_key=${secret} ${"x".repeat(1_000)}`,
          { status: 502 },
        ),
      ),
    );

    const error = await fetchLibraryApiJson(
      "/status",
      "test-client",
      "gateway-token",
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain(REDACTION_PLACEHOLDER);
    expect(message).not.toContain(secret);
    expect(message).toMatch(/\.\.\.\[truncated\]$/u);
    expect(message.length).toBeLessThanOrEqual(200);
  });

  it("redacts and bounds structured gateway bodies without a safe message", async () => {
    const secret = "structured-library-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            diagnostic: `api_key=${secret} ${"x".repeat(1_000)}`,
          }),
          {
            status: 502,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const error = await fetchLibraryApiJson(
      "/status",
      "test-client",
      "gateway-token",
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain(REDACTION_PLACEHOLDER);
    expect(message).not.toContain(secret);
    expect(message).toMatch(/\.\.\.\[truncated\]$/u);
    expect(message.length).toBeLessThanOrEqual(200);
  });

  it("preserves safe messages from structured gateway errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Library busy" } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      fetchLibraryApiJson("/status", "test-client", "gateway-token"),
    ).rejects.toThrow("Library busy");
  });
});

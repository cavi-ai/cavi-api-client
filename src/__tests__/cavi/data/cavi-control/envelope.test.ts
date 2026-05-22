import { describe, expect, it } from "vitest";
import { classifyFallbackError, withFallback } from "../../../../cavi/data/cavi-control/envelope";

describe("envelope fallback classification", () => {
  it("treats unknown-method WS errors as fallback-eligible (old gateway binary)", async () => {
    const envelope = await withFallback({
      area: "overview",
      expectedContract: "WS health.snapshot",
      note: "Overview unavailable",
      fallback: { ok: true },
      run: async () => {
        throw new Error("unknown method: health.snapshot");
      },
    });

    expect(envelope.source).toBe("mock");
    expect(envelope.data).toEqual({ ok: true });
    expect(envelope.contractGaps[0]?.reason).toBe("backend-unavailable");
    expect(envelope.contractGaps[0]?.note).toMatch(/health\.snapshot/);
  });

  it("treats websocket/backend outages as fallback-eligible", async () => {
    const envelope = await withFallback({
      area: "overview",
      expectedContract: "WS sessions.list",
      note: "Overview unavailable",
      fallback: { ok: false },
      run: async () => {
        throw new Error("ws unavailable");
      },
    });

    expect(envelope.source).toBe("mock");
    expect(envelope.contractGaps[0]?.reason).toBe("backend-unavailable");
  });

  it("rethrows unknown runtime failures instead of masking them with mock data", async () => {
    await expect(
      withFallback({
        area: "overview",
        expectedContract: "WS sessions.list",
        note: "Overview unavailable",
        fallback: { ok: false },
        run: async () => {
          throw new Error("Cannot normalize undefined run payload");
        },
      }),
    ).rejects.toThrow("Cannot normalize undefined run payload");
  });

  it("keeps local TypeError regressions classified as unknown", () => {
    expect(
      classifyFallbackError(new TypeError("Cannot read properties of undefined")),
    ).toMatchObject({
      reason: "unknown",
      message: "Runtime: Cannot read properties of undefined.",
    });
    expect(
      classifyFallbackError(new TypeError("Failed to fetch")),
    ).toMatchObject({
      reason: "backend-unavailable",
      message: "The gateway request failed before a response was received.",
    });
  });
});

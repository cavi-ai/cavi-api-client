import { describe, expect, it } from "vitest";
import {
  classifyFallbackError,
  withFallback,
  withMutationResult,
} from "../../../core/gateway/envelope/index";
import { GatewayHttpError } from "../../../core/http/gateway-error";

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

  it("returns mutation fallback data for classified backend failures", async () => {
    const result = await withMutationResult({
      area: "project-board-backlog-create",
      expectedContract: "POST /api/plugins/cavi-control/kanban/backlog",
      note: "Backlog create unavailable",
      fallback: () => ({ id: "local", title: "Local fallback" }),
      run: async () => {
        throw new GatewayHttpError("missing route", 404);
      },
    });

    expect(result).toMatchObject({
      source: "mock",
      data: { id: "local", title: "Local fallback" },
      contractGaps: [
        {
          area: "project-board-backlog-create",
          reason: "endpoint-not-found",
          httpStatus: 404,
        },
      ],
    });
  });

  it("still rejects mutation fallback for unknown local failures", async () => {
    await expect(
      withMutationResult({
        area: "project-board-email-create",
        expectedContract: "PUT /api/plugins/cavi-control/kanban/profile",
        note: "Email mutation failed",
        fallback: () => ({ id: "local" }),
        run: async () => {
          throw new Error("Valid email address required.");
        },
      }),
    ).rejects.toThrow("Valid email address required.");
  });
});

import { describe, expect, it } from "vitest";
import type {
  TransportConformanceFixture,
  TransportConformanceObservation,
  TransportKind,
} from "../../testing/index.js";
import { inspectTransportConformance } from "../../testing/index.js";

const kinds = ["http", "sse", "websocket", "json-rpc", "stdio", "unix"] as const;

function fixture(
  kind: TransportKind,
  observation: Partial<TransportConformanceObservation> = {},
): TransportConformanceFixture {
  return {
    kind,
    async run() {
      return {
        attempts: 1,
        maxAttempts: 1,
        mutationSendCount: 1,
        emissionsAfterAbort: 0,
        serializedErrors: [],
        serializedEvents: [],
        openResources: 0,
        protocolViolations: [],
        ...observation,
      };
    },
  };
}

describe("inspectTransportConformance", () => {
  it.each(kinds)("accepts a conformant %s fixture", async (kind) => {
    await expect(inspectTransportConformance(fixture(kind))).resolves.toEqual({
      ok: true,
      kind,
      issues: [],
    });
  });

  it("reports work emitted after abort", async () => {
    const report = await inspectTransportConformance(fixture("sse", { emissionsAfterAbort: 1 }));
    expect(report.issues.map(({ code }) => code)).toContain("abort_leak");
  });

  it("reports attempts beyond the fixture retry bound", async () => {
    const report = await inspectTransportConformance(fixture("websocket", {
      attempts: 4,
      maxAttempts: 3,
    }));
    expect(report.issues.map(({ code }) => code)).toContain("unbounded_retry");
  });

  it("reports mutation replay and leaked auth", async () => {
    const report = await inspectTransportConformance(fixture("http", {
      attempts: 2,
      maxAttempts: 2,
      mutationSendCount: 2,
      serializedErrors: ["request failed: Authorization: Bearer top-secret"],
    }));
    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "mutation_replayed",
      "secret_exposed",
    ]));
  });

  it("reports secrets in serialized events", async () => {
    const report = await inspectTransportConformance(fixture("json-rpc", {
      serializedEvents: ["api_key=sk-secret-value"],
    }));
    expect(report.issues.map(({ code }) => code)).toContain("secret_exposed");
  });

  it("reports resources left open", async () => {
    const report = await inspectTransportConformance(fixture("stdio", { openResources: 1 }));
    expect(report.issues.map(({ code }) => code)).toContain("resource_leak");
  });

  it("reports protocol-specific violations as data", async () => {
    const report = await inspectTransportConformance(fixture("unix", {
      protocolViolations: ["content-length frame body was truncated"],
    }));
    expect(report.issues).toContainEqual({
      code: "protocol_mismatch",
      message: "content-length frame body was truncated",
    });
  });

  it("does not mistake redaction markers for leaked secrets", async () => {
    const report = await inspectTransportConformance(fixture("http", {
      serializedErrors: ["Authorization: Bearer [REDACTED]"],
      serializedEvents: ["api_key=[REDACTED]"],
    }));
    expect(report.ok).toBe(true);
  });
});

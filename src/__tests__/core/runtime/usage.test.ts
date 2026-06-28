import { describe, expect, it } from "vitest";
import {
  estimateUsageCost,
  normalizeRuntimeUsage,
  type RuntimeUsage,
} from "../../../core/runtime/usage";

describe("normalizeRuntimeUsage", () => {
  it("returns undefined for empty / non-numeric input", () => {
    expect(normalizeRuntimeUsage(undefined, "claude-sdk")).toBeUndefined();
    expect(normalizeRuntimeUsage({}, "claude-sdk")).toBeUndefined();
  });

  it("maps Anthropic flat keys including cache fields", () => {
    const usage = normalizeRuntimeUsage(
      {
        input_tokens: 100,
        output_tokens: 40,
        cache_read_input_tokens: 25,
        cache_creation_input_tokens: 10,
      },
      "claude-sdk",
    );
    expect(usage).toMatchObject({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      cacheReadTokens: 25,
      cacheWriteTokens: 10,
    });
    expect(usage?.raw).toEqual({
      input_tokens: 100,
      output_tokens: 40,
      cache_read_input_tokens: 25,
      cache_creation_input_tokens: 10,
    });
  });

  it("maps OpenAI keys and prefers a reported total", () => {
    const usage = normalizeRuntimeUsage(
      { input_tokens: 60, output_tokens: 20, total_tokens: 80, cached_tokens: 12 },
      "codex-responses",
    );
    expect(usage).toMatchObject({
      inputTokens: 60,
      outputTokens: 20,
      totalTokens: 80,
      cacheReadTokens: 12,
    });
  });

  it("maps gateway camelCase totals", () => {
    const usage = normalizeRuntimeUsage({ totalTokens: 200 }, "gateway");
    expect(usage).toMatchObject({ totalTokens: 200 });
  });
});

describe("estimateUsageCost", () => {
  it("prices each token bucket per million and sums them", () => {
    const usage: RuntimeUsage = {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 2_000_000,
    };
    const cost = estimateUsageCost(usage, {
      inputPerMTok: 3,
      outputPerMTok: 15,
      cacheReadPerMTok: 0.3,
    });
    expect(cost).toBeCloseTo(3 + 7.5 + 0.6, 6);
  });

  it("contributes 0 for missing counts or missing prices", () => {
    expect(estimateUsageCost({}, {})).toBe(0);
    expect(estimateUsageCost({ inputTokens: 1_000_000 }, {})).toBe(0);
    expect(estimateUsageCost({}, { inputPerMTok: 3 })).toBe(0);
  });
});

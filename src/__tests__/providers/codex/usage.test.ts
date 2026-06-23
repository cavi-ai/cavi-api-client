import { describe, expect, it } from "vitest";
import { flattenOpenAIUsage } from "../../../providers/codex/usage";

describe("flattenOpenAIUsage", () => {
  it("keeps top-level numbers and lifts nested detail numbers to flat keys", () => {
    const flat = flattenOpenAIUsage({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: { cached_tokens: 20 },
      output_tokens_details: { reasoning_tokens: 8 },
    });
    expect(flat).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      cached_tokens: 20,
      reasoning_tokens: 8,
    });
  });

  it("returns undefined for non-objects / no numeric fields", () => {
    expect(flattenOpenAIUsage(undefined)).toBeUndefined();
    expect(flattenOpenAIUsage({ note: "x" })).toBeUndefined();
  });
});

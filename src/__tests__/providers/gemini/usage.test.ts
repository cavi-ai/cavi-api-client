import { describe, expect, it } from "vitest";
import { flattenGeminiUsageMetadata } from "../../../providers/gemini/usage";

describe("flattenGeminiUsageMetadata", () => {
  it("keeps top-level numeric token counts", () => {
    expect(
      flattenGeminiUsageMetadata({
        promptTokenCount: 100,
        candidatesTokenCount: 40,
        totalTokenCount: 140,
        cachedContentTokenCount: 12,
      }),
    ).toEqual({
      promptTokenCount: 100,
      candidatesTokenCount: 40,
      totalTokenCount: 140,
      cachedContentTokenCount: 12,
    });
  });

  it("ignores nested *Details arrays and non-numbers", () => {
    expect(
      flattenGeminiUsageMetadata({
        promptTokenCount: 7,
        promptTokensDetails: [{ modality: "TEXT", tokenCount: 7 }],
        modelVersion: "x",
      }),
    ).toEqual({ promptTokenCount: 7 });
  });

  it("returns undefined for empty / non-objects", () => {
    expect(flattenGeminiUsageMetadata(undefined)).toBeUndefined();
    expect(flattenGeminiUsageMetadata({})).toBeUndefined();
  });
});

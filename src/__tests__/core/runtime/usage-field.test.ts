import { describe, expect, it } from "vitest";
import type { RuntimeRunStatus } from "../../../core/runtime/run";
import type { RuntimeUsage } from "../../../core/runtime/usage";

describe("RuntimeRunStatus.tokens", () => {
  it("accepts a normalized RuntimeUsage on the tokens field", () => {
    const tokens: RuntimeUsage = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };
    const status: RuntimeRunStatus = {
      run_id: "r1",
      status: "completed",
      usage: { input_tokens: 1, output_tokens: 2 },
      tokens,
    };
    expect(status.tokens?.totalTokens).toBe(3);
    expect(status.usage?.input_tokens).toBe(1);
  });
});

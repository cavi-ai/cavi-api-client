import { describe, expect, it } from "vitest";
import { withFallback } from "../../../core/gateway/envelope/index";

describe("C2: withFallback observability hook", () => {
  it("calls onResolve with source=gateway on success", async () => {
    const seen: { source: string; fellBack: boolean }[] = [];
    const env = await withFallback({
      run: async () => 42,
      fallback: 0,
      area: "test",
      expectedContract: "answer",
      note: "n",
      onResolve: (info) => seen.push({ source: info.source, fellBack: info.fellBack }),
    });
    expect(env.source).toBe("gateway");
    expect(seen).toEqual([{ source: "gateway", fellBack: false }]);
  });

  it("calls onResolve with source=mock when it falls back", async () => {
    const seen: { source: string; fellBack: boolean }[] = [];
    const env = await withFallback({
      run: async () => {
        // classifies as backend-unavailable (not "unknown"), so the fallback fires.
        throw new Error("unknown method: doThing");
      },
      fallback: 7,
      area: "test",
      expectedContract: "answer",
      note: "n",
      onResolve: (info) => seen.push({ source: info.source, fellBack: info.fellBack }),
    });
    expect(env.source).toBe("mock");
    expect(seen).toEqual([{ source: "mock", fellBack: true }]);
  });
});

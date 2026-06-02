import { describe, expect, it } from "vitest";
import {
  RUNTIME_SURFACES,
  runtimeSupports,
  type RuntimeCapabilities,
} from "../../../core/runtime/capabilities";

const claudeCaps: RuntimeCapabilities = {
  providerKind: "claude-sdk",
  protocolVersion: "2023-06-01",
  auth: { type: "api-key", required: true },
  supports: { runs: true, streaming: true },
};

describe("runtime capabilities", () => {
  it("lists the canonical surfaces", () => {
    expect(RUNTIME_SURFACES).toContain("runs");
    expect(RUNTIME_SURFACES).toContain("teams");
    expect(RUNTIME_SURFACES).toContain("media");
  });

  it("treats undeclared surfaces as unsupported", () => {
    expect(runtimeSupports(claudeCaps, "runs")).toBe(true);
    expect(runtimeSupports(claudeCaps, "media")).toBe(false);
    expect(runtimeSupports(claudeCaps, "teams")).toBe(false);
  });
});

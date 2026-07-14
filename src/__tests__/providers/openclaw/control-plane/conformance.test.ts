import { describe, expect, it } from "vitest";
import { OPENCLAW_PROVIDER_MODULE } from "../../../../providers/openclaw/provider-module";

describe("OpenClaw canonical control-plane registration", () => {
  it("registers its canonical factory and all seven modules", () => {
    expect(OPENCLAW_PROVIDER_MODULE.createCanonicalControlPlane).toBeTypeOf("function");
    expect(OPENCLAW_PROVIDER_MODULE.controlPlane?.modules).toEqual({
      sessions: true, models: true, usage: true, tasks: true,
      workspace: true, authStatus: true, events: true,
    });
  });
});

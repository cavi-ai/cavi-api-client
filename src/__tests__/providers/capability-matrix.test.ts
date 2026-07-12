import { describe, expect, it } from "vitest";
import {
  RUNTIME_PROVIDER_CAPABILITY_MATRIX,
  getRuntimeProviderCapabilityRow,
} from "../../providers/capability-matrix.js";

describe("runtime provider capability matrix", () => {
  it("contains every shipped provider entry", () => {
    expect(Object.keys(RUNTIME_PROVIDER_CAPABILITY_MATRIX).sort()).toEqual([
      "claude",
      "claude-managed-agents",
      "codex",
      "gemini",
      "hermes",
      "openclaw",
    ]);
  });

  it("does not advertise unimplemented control-plane modules in the foundation slice", () => {
    for (const row of Object.values(RUNTIME_PROVIDER_CAPABILITY_MATRIX)) {
      expect(row.controlPlane).toEqual({});
    }
  });

  it("records runtime surfaces and implemented transports separately", () => {
    expect(RUNTIME_PROVIDER_CAPABILITY_MATRIX.claude).toMatchObject({
      runtime: { runs: true, streaming: true, batch: true },
      transports: { http: expect.any(Object), sse: expect.any(Object) },
    });
    expect(RUNTIME_PROVIDER_CAPABILITY_MATRIX.openclaw).toMatchObject({
      runtime: { runs: true, streaming: true, media: false, wiki: false },
      transports: {
        http: expect.any(Object),
        sse: expect.any(Object),
        websocket: expect.any(Object),
        "json-rpc": expect.any(Object),
      },
    });
  });

  it("returns only known frozen rows", () => {
    expect(getRuntimeProviderCapabilityRow("codex")).toBe(
      RUNTIME_PROVIDER_CAPABILITY_MATRIX.codex,
    );
    expect(getRuntimeProviderCapabilityRow("unknown")).toBeUndefined();
    expect(Object.isFrozen(RUNTIME_PROVIDER_CAPABILITY_MATRIX)).toBe(true);
    expect(Object.isFrozen(RUNTIME_PROVIDER_CAPABILITY_MATRIX.codex)).toBe(true);
  });
});

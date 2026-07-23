import { describe, it, expect } from "vitest";
import {
  mergeCapabilitySupport,
  resolvedSupports,
} from "../../contracts/capability-source.js";
import type { CapabilitySupport } from "../../core/runtime/capability-taxonomy.js";

describe("capability source — runtime over static fallback", () => {
  it("runtime keys win over the fallback", () => {
    // The OpenClaw plugin-gating case: static default gates media/wiki off;
    // a gateway instance whose /v1/capabilities reports them on flips them on.
    const fallback: CapabilitySupport = { runs: true, media: false, wiki: false };
    const runtime: CapabilitySupport = { media: true, wiki: true };
    expect(mergeCapabilitySupport(fallback, runtime)).toEqual({
      runs: true,
      media: true,
      wiki: true,
    });
  });

  it("fallback fills what the runtime response did not mention", () => {
    const fallback: CapabilitySupport = { runs: true, kanban: true };
    const runtime: CapabilitySupport = { media: true };
    expect(mergeCapabilitySupport(fallback, runtime)).toEqual({
      runs: true,
      kanban: true,
      media: true,
    });
  });

  it("an explicit runtime false overrides a fallback true", () => {
    const fallback: CapabilitySupport = { wiki: true };
    const runtime: CapabilitySupport = { wiki: false };
    expect(mergeCapabilitySupport(fallback, runtime).wiki).toBe(false);
  });

  it("does not mutate its inputs", () => {
    const fallback: CapabilitySupport = { runs: true };
    const runtime: CapabilitySupport = { media: true };
    mergeCapabilitySupport(fallback, runtime);
    expect(fallback).toEqual({ runs: true });
    expect(runtime).toEqual({ media: true });
  });

  it("resolvedSupports: runtime authoritative, falls back when runtime absent", () => {
    const fallback: CapabilitySupport = { media: false };
    expect(resolvedSupports(fallback, { media: true }, "media")).toBe(true);
    expect(resolvedSupports(fallback, undefined, "media")).toBe(false);
    expect(resolvedSupports(fallback, {}, "wiki")).toBe(false);
  });
});

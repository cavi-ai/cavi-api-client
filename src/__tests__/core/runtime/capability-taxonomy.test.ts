import { describe, it, expect } from "vitest";
import { RUNTIME_SURFACES } from "../../../core/runtime/capabilities.js";
import {
  CAPABILITY_TAXONOMY,
  CAPABILITY_GROUPS,
  RUNTIME_SURFACE_CAPABILITY,
  CONTROL_PLANE_MODULE_CAPABILITY,
  supportsCapability,
  isCapabilityKey,
  type CapabilityMap,
} from "../../../core/runtime/capability-taxonomy.js";

describe("unified capability taxonomy", () => {
  it("has no duplicate keys", () => {
    expect(new Set(CAPABILITY_TAXONOMY).size).toBe(CAPABILITY_TAXONOMY.length);
  });

  it("groups partition the taxonomy exactly (every key in exactly one group)", () => {
    const grouped = Object.values(CAPABILITY_GROUPS).flat();
    expect(grouped.length).toBe(CAPABILITY_TAXONOMY.length);
    expect(new Set(grouped)).toEqual(new Set(CAPABILITY_TAXONOMY));
  });

  it("is a strict superset of legacy runtime SURFACES", () => {
    // one-to-one: every surface mapped, nothing extra
    expect(Object.keys(RUNTIME_SURFACE_CAPABILITY).sort()).toEqual(
      [...RUNTIME_SURFACES].sort(),
    );
    for (const surface of RUNTIME_SURFACES) {
      expect(CAPABILITY_TAXONOMY).toContain(RUNTIME_SURFACE_CAPABILITY[surface]);
    }
  });

  it("is a strict superset of legacy control-plane MODULES", () => {
    for (const capability of Object.values(CONTROL_PLANE_MODULE_CAPABILITY)) {
      expect(CAPABILITY_TAXONOMY).toContain(capability);
    }
  });

  it("de-dupes `workspace` across both legacy axes into one key", () => {
    expect(RUNTIME_SURFACE_CAPABILITY.workspace).toBe("workspace");
    expect(CONTROL_PLANE_MODULE_CAPABILITY.workspace).toBe("workspace");
    expect(CAPABILITY_TAXONOMY.filter((k) => k === "workspace")).toHaveLength(1);
  });

  it("surfaces the control-plane-only capabilities the surface axis lacked", () => {
    // sessions/models/usage/tasks/events existed only as modules, never as surfaces
    for (const cap of ["sessions", "models", "usage", "tasks", "events"] as const) {
      expect(CAPABILITY_TAXONOMY).toContain(cap);
    }
  });

  it("supportsCapability reads declared support (=== true), nothing else", () => {
    const map: CapabilityMap = {
      providerKind: "test",
      supports: { runs: true, media: false },
    };
    expect(supportsCapability(map, "runs")).toBe(true);
    expect(supportsCapability(map, "media")).toBe(false);
    expect(supportsCapability(map, "wiki")).toBe(false); // absent ⇒ unsupported
  });

  it("isCapabilityKey narrows arbitrary strings", () => {
    expect(isCapabilityKey("runs")).toBe(true);
    expect(isCapabilityKey("agentConfig")).toBe(true);
    expect(isCapabilityKey("nonsense")).toBe(false);
    expect(isCapabilityKey("")).toBe(false);
  });
});

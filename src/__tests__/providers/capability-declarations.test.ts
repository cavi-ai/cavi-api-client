import { describe, it, expect } from "vitest";
import {
  RUNTIME_PROVIDER_CAPABILITY_MATRIX,
  type RuntimeProviderCapabilityMatrixKey,
} from "../../providers/capability-matrix.js";
import {
  RUNTIME_SURFACE_CAPABILITY,
  CONTROL_PLANE_MODULE_CAPABILITY,
  type CapabilityKey,
} from "../../core/runtime/capability-taxonomy.js";
import {
  PROVIDER_CAPABILITIES,
  declaredCapabilities,
} from "../../providers/capability-declarations.js";

/** Derive the capability set the CURRENT two sources imply for a provider. */
function expectedFromLegacy(
  key: RuntimeProviderCapabilityMatrixKey,
): Set<CapabilityKey> {
  const row = RUNTIME_PROVIDER_CAPABILITY_MATRIX[key];
  const set = new Set<CapabilityKey>();
  for (const [surface, on] of Object.entries(row.runtime)) {
    if (on) {
      set.add(
        RUNTIME_SURFACE_CAPABILITY[surface as keyof typeof RUNTIME_SURFACE_CAPABILITY],
      );
    }
  }
  for (const [mod, on] of Object.entries(row.controlPlane.modules ?? {})) {
    if (on) {
      set.add(
        CONTROL_PLANE_MODULE_CAPABILITY[mod as keyof typeof CONTROL_PLANE_MODULE_CAPABILITY],
      );
    }
  }
  return set;
}

/** Sanctioned deltas vs the legacy matrix — every one must be justified. */
const CORRECTIONS: Partial<Record<RuntimeProviderCapabilityMatrixKey, CapabilityKey[]>> = {
  openclaw: ["media", "wiki"],
};

const matrixKeys = Object.keys(
  RUNTIME_PROVIDER_CAPABILITY_MATRIX,
) as RuntimeProviderCapabilityMatrixKey[];

describe("single-source provider capabilities", () => {
  it("covers exactly the providers in the matrix", () => {
    expect(new Set(Object.keys(PROVIDER_CAPABILITIES))).toEqual(new Set(matrixKeys));
  });

  for (const key of matrixKeys) {
    it(`${key}: equals legacy (matrix runtime ∪ control-plane modules) + documented corrections`, () => {
      const expected = expectedFromLegacy(key);
      for (const capability of CORRECTIONS[key] ?? []) expected.add(capability);
      expect(new Set(declaredCapabilities(key))).toEqual(expected);
    });
  }

  it("the ONLY drift from the matrix is OpenClaw media+wiki", () => {
    for (const key of matrixKeys) {
      const declared = new Set(declaredCapabilities(key));
      const legacy = expectedFromLegacy(key);
      const added = [...declared].filter((c) => !legacy.has(c)).sort();
      expect(added).toEqual(key === "openclaw" ? ["media", "wiki"] : []);
    }
  });
});

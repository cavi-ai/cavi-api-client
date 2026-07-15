import { describe, expect, expectTypeOf, it } from "vitest";

import type { RuntimeControlExtensionDescriptor } from "../../../../core/runtime/control-plane/extensions.js";
import type { CaviControlAdapters } from "../../../../extensions/cavi/adapters/create-cavi-control-adapters.js";
import { CAVI_CONTROL_EXTENSION } from "../../../../extensions/cavi/adapters/runtime-control-extension.js";

describe("CAVI control runtime extension", () => {
  it("defines the typed cavi.control capability descriptor", () => {
    expect(CAVI_CONTROL_EXTENSION).toEqual({ id: "cavi.control" });
    expect(Object.isFrozen(CAVI_CONTROL_EXTENSION)).toBe(true);
    expectTypeOf(CAVI_CONTROL_EXTENSION)
      .toEqualTypeOf<RuntimeControlExtensionDescriptor<CaviControlAdapters>>();
  });
});

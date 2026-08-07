import { describe, expect, it } from "vitest";
import { unflattenPortalConfigPatchKeys } from "../../../core/gateway/portal/config-patch";

describe("portal config patch", () => {
  it("unflattens normal nested keys", () => {
    expect(
      unflattenPortalConfigPatchKeys({
        "snapshot › thresholds › warning": 75,
      }),
    ).toEqual({
      snapshot: {
        thresholds: {
          warning: 75,
        },
      },
    });
  });

  it.each([
    "__proto__ › caviPortalConfigPollutionProbe",
    "constructor › prototype › caviPortalConfigPollutionProbe",
  ])(
    "rejects the dangerous config key %s",
    (path) => {
      const objectPrototype = Object.prototype as Record<string, unknown>;
      try {
        expect(() => unflattenPortalConfigPatchKeys({ [path]: true })).toThrow(
          /unsafe path segment/iu,
        );
      } finally {
        delete objectPrototype.caviPortalConfigPollutionProbe;
      }
    },
  );
});

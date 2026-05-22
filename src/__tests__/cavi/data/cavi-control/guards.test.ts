import { describe, expect, it } from "vitest";
import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  isRecord,
} from "../../../../cavi/data/cavi-control/guards";

describe("guards", () => {
  describe("isRecord", () => {
    it("accepts plain objects", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });

    it("rejects null, undefined, and primitives", () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord(undefined)).toBe(false);
      expect(isRecord("x")).toBe(false);
      expect(isRecord(0)).toBe(false);
    });

    it("treats arrays as records (typeof object)", () => {
      expect(isRecord([])).toBe(true);
    });
  });

  describe("asString", () => {
    it("returns trimmed non-empty strings", () => {
      expect(asString("  hi  ")).toBe("hi");
    });

    it("returns null for empty or non-strings", () => {
      expect(asString("")).toBe(null);
      expect(asString("   ")).toBe(null);
      expect(asString(null)).toBe(null);
      expect(asString(1)).toBe(null);
    });
  });

  describe("asNumber", () => {
    it("returns finite numbers", () => {
      expect(asNumber(0)).toBe(0);
      expect(asNumber(-1.5)).toBe(-1.5);
    });

    it("returns null for non-finite or wrong types", () => {
      expect(asNumber(NaN)).toBe(null);
      expect(asNumber(Infinity)).toBe(null);
      expect(asNumber("1")).toBe(null);
      expect(asNumber(null)).toBe(null);
    });
  });

  describe("asStringArray", () => {
    it("maps and filters to non-empty strings", () => {
      expect(asStringArray(["a", " b ", "", 3, null])).toEqual(["a", "b"]);
    });

    it("returns empty array for non-array", () => {
      expect(asStringArray(null)).toEqual([]);
      expect(asStringArray({})).toEqual([]);
    });
  });

  describe("asBoolean", () => {
    it("returns booleans only", () => {
      expect(asBoolean(true)).toBe(true);
      expect(asBoolean(false)).toBe(false);
      expect(asBoolean(0)).toBe(null);
      expect(asBoolean("true")).toBe(null);
    });
  });
});

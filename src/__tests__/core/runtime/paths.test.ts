import { describe, expect, it } from "vitest";
import {
  normalizeRuntimeBasePath,
  resolvePublicRuntimeAsset,
  withRuntimeBasePath,
} from "../../../core/runtime/paths";

describe("runtime path helpers", () => {
  it("normalizes empty and root base paths to no prefix", () => {
    expect(normalizeRuntimeBasePath(undefined)).toBe("");
    expect(normalizeRuntimeBasePath("")).toBe("");
    expect(normalizeRuntimeBasePath("/")).toBe("");
    expect(normalizeRuntimeBasePath("./")).toBe("");
  });

  it("normalizes configured base paths with a single leading slash", () => {
    expect(normalizeRuntimeBasePath("operator")).toBe("/operator");
    expect(normalizeRuntimeBasePath("/operator/")).toBe("/operator");
  });

  it("prefixes relative runtime paths once", () => {
    expect(withRuntimeBasePath("/api/__session/status", "/operator")).toBe(
      "/operator/api/__session/status",
    );
    expect(withRuntimeBasePath("/operator/api/__session/status", "/operator")).toBe(
      "/operator/api/__session/status",
    );
  });

  it("leaves absolute and embedded asset URLs unchanged", () => {
    expect(withRuntimeBasePath("https://example.test/a.png", "/operator")).toBe(
      "https://example.test/a.png",
    );
    expect(withRuntimeBasePath("data:image/png;base64,x", "/operator")).toBe(
      "data:image/png;base64,x",
    );
    expect(resolvePublicRuntimeAsset("blob:http://example.test/x", "/operator")).toBe(
      "blob:http://example.test/x",
    );
  });
});

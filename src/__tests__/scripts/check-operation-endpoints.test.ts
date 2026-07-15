import { describe, expect, it } from "vitest";
import {
  extractHttpPaths,
  findOrphanPaths,
  isKnownPath,
} from "../../../scripts/docs/check-operation-endpoints.mjs";

describe("extractHttpPaths", () => {
  it("pulls path tokens from an HTTP line, ignoring provider labels and n/a", () => {
    const md = "**HTTP** `POST /v1/messages` (Claude) · `n/a (client-side)`\n";
    expect(extractHttpPaths(md)).toEqual(["/v1/messages"]);
  });

  it("reduces dynamic segments to their static prefix", () => {
    const md = "**HTTP** `GET /v1/batches/:id/output`\n";
    expect(extractHttpPaths(md)).toEqual(["/v1/batches"]);
  });
});

describe("findOrphanPaths", () => {
  it("flags a path absent from the owner literal corpus", () => {
    const corpus = '"/v1/messages" "/v1/batches"';
    expect(findOrphanPaths(["/v1/messages", "/v1/ghost"], corpus)).toEqual([
      "/v1/ghost",
    ]);
  });

  it("returns empty when every path is present", () => {
    const corpus = '"/v1/messages"';
    expect(findOrphanPaths(["/v1/messages"], corpus)).toEqual([]);
  });

  it("accepts a version-prefixed assembled path via its version-stripped remainder", () => {
    // Gemini builds `/${GEMINI_API_VERSION}/models/...`, so `/v1beta/models` is
    // not a contiguous literal but `/models` is.
    const corpus = 'const GEMINI_API_VERSION = "v1beta"; `/models/${x}:generateContent`';
    expect(isKnownPath("/v1beta/models", corpus)).toBe(true);
    expect(findOrphanPaths(["/v1beta/models"], corpus)).toEqual([]);
  });

  it("still flags a version-prefixed path whose remainder is absent", () => {
    const corpus = '`/models/${x}`';
    expect(isKnownPath("/v1beta/wombat", corpus)).toBe(false);
    expect(findOrphanPaths(["/v1beta/wombat"], corpus)).toEqual(["/v1beta/wombat"]);
  });
});

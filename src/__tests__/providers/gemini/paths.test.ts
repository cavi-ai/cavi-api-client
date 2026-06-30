import { describe, expect, it } from "vitest";
import {
  GEMINI_API_BASE_URL,
  geminiGenerateContentPath,
  geminiStreamGenerateContentPath,
} from "../../../providers/gemini/paths";

describe("gemini paths", () => {
  it("exposes the Developer API base url", () => {
    expect(GEMINI_API_BASE_URL).toBe("https://generativelanguage.googleapis.com");
  });

  it("builds the generateContent path with the model in the URL", () => {
    expect(geminiGenerateContentPath("gemini-2.5-flash")).toBe(
      "/v1beta/models/gemini-2.5-flash:generateContent",
    );
  });

  it("builds the streaming path with alt=sse", () => {
    expect(geminiStreamGenerateContentPath("gemini-2.5-flash")).toBe(
      "/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
  });

  it("url-encodes the model segment", () => {
    expect(geminiGenerateContentPath("models/x y")).toContain("models%2Fx%20y");
  });
});

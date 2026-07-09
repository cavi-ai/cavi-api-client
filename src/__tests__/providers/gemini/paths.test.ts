import { describe, expect, it } from "vitest";
import {
  GEMINI_API_BASE_URL,
  geminiGenerateContentPath,
  geminiStreamGenerateContentPath,
  geminiBatchGenerateContentPath,
  geminiBatchPath,
  geminiBatchCancelPath,
  geminiFileDownloadPath,
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

  it("builds batch and file download paths", () => {
    expect(geminiBatchGenerateContentPath("gemini-2.5-flash")).toBe(
      "/v1beta/models/gemini-2.5-flash:batchGenerateContent",
    );
    expect(geminiBatchPath("123")).toBe("/v1beta/batches/123");
    expect(geminiBatchCancelPath("batches/123")).toBe("/v1beta/batches/123:cancel");
    expect(geminiFileDownloadPath("files/out")).toContain("/download/v1beta/files/out:download");
  });
});

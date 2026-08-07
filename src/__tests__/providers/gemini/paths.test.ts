import { describe, expect, it } from "vitest";
import {
  GEMINI_API_BASE_URL,
  geminiGenerateContentPath,
  geminiStreamGenerateContentPath,
  geminiBatchGenerateContentPath,
  geminiBatchPath,
  geminiBatchCancelPath,
  geminiFilePath,
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

  it("encodes untrusted batch and file resource-name segments", () => {
    expect(geminiBatchPath("batches/team/one?key=value#tail")).toBe(
      "/v1beta/batches/team%2Fone%3Fkey%3Dvalue%23tail",
    );
    expect(geminiFilePath("files/team/out?alt=media#tail")).toBe(
      "/v1beta/files/team%2Fout%3Falt%3Dmedia%23tail",
    );
    expect(geminiFileDownloadPath("files/team/out?alt=media#tail")).toBe(
      "/download/v1beta/files/team%2Fout%3Falt%3Dmedia%23tail:download?alt=media",
    );
  });

  it("preserves valid percent triplets in legacy pass-through paths", () => {
    expect(geminiBatchPath("batches/a%2Fb")).toBe(
      "/v1beta/batches/a%2Fb",
    );
    expect(geminiFileDownloadPath("files/a%2Fb")).toBe(
      "/download/v1beta/files/a%2Fb:download?alt=media",
    );
  });

  it("encodes raw and malformed delimiters without changing path structure", () => {
    expect(geminiBatchPath("batches/a b%2/b?key=value#tail")).toBe(
      "/v1beta/batches/a%20b%252%2Fb%3Fkey%3Dvalue%23tail",
    );
    expect(geminiFileDownloadPath("files/../a%zz/b?alt=x#tail")).toBe(
      "/download/v1beta/files/..%2Fa%25zz%2Fb%3Falt%3Dx%23tail:download?alt=media",
    );
  });

  it("keeps geminiFilePath's historical encodeURIComponent behavior", () => {
    expect(geminiFilePath("files/a%2Fb")).toBe(
      "/v1beta/files/a%252Fb",
    );
  });

  it.each([
    ["batch", (value: string) => geminiBatchPath(value)],
    ["file", (value: string) => geminiFilePath(value)],
    ["file download", (value: string) => geminiFileDownloadPath(value)],
  ])("rejects empty and traversal-only %s identifiers", (_label, buildPath) => {
    expect(() => buildPath(" ")).toThrow(/invalid .* id/u);
    expect(() => buildPath("..")).toThrow(/invalid .* id/u);
    expect(() => buildPath("%2e%2e")).toThrow(/invalid .* id/u);
  });
});

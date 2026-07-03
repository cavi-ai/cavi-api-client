import { describe, expect, it } from "vitest";
import {
  CODEX_API_ENDPOINTS,
  codexFilePath,
  codexFileContentPath,
  codexBatchPath,
  codexBatchCancelPath,
} from "../../../providers/codex/paths";

describe("codex files + batches paths", () => {
  it("exposes the files and batches collection endpoints", () => {
    expect(CODEX_API_ENDPOINTS.files).toBe("/v1/files");
    expect(CODEX_API_ENDPOINTS.batches).toBe("/v1/batches");
  });
  it("builds file + batch paths with encoded ids", () => {
    expect(codexFilePath("file-1")).toBe("/v1/files/file-1");
    expect(codexFileContentPath("file-1")).toBe("/v1/files/file-1/content");
    expect(codexBatchPath("batch_1")).toBe("/v1/batches/batch_1");
    expect(codexBatchCancelPath("batch_1")).toBe("/v1/batches/batch_1/cancel");
    expect(codexBatchPath("a b")).toContain("a%20b");
  });
});

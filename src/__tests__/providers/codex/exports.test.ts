import { describe, expect, it } from "vitest";
import * as codex from "../../../providers/codex/index";

describe("codex public exports", () => {
  it("exports the files client, batch mappers, response primitives, and paths", () => {
    for (const name of [
      "CodexFilesClient",
      "buildCodexResponseBody",
      "mapOpenAIResponseToRunStatus",
      "mapOpenAIBatch",
      "parseOpenAIBatchOutput",
      "buildBatchInputJsonl",
      "codexFilePath",
      "codexFileContentPath",
      "codexBatchPath",
      "codexBatchCancelPath",
    ]) {
      expect(typeof (codex as Record<string, unknown>)[name]).toBe("function");
    }
  });
});

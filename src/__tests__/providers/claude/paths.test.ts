import { describe, expect, it } from "vitest";
import {
  CLAUDE_API_ENDPOINTS,
  claudeMessageBatchPath,
  claudeMessageBatchCancelPath,
  claudeMessageBatchResultsPath,
} from "../../../providers/claude/paths";

describe("claude batch paths", () => {
  it("exposes the message-batches collection endpoint", () => {
    expect(CLAUDE_API_ENDPOINTS.messageBatches).toBe("/v1/messages/batches");
  });
  it("builds per-batch paths with an encoded id", () => {
    expect(claudeMessageBatchPath("msgbatch_1")).toBe("/v1/messages/batches/msgbatch_1");
    expect(claudeMessageBatchCancelPath("msgbatch_1")).toBe("/v1/messages/batches/msgbatch_1/cancel");
    expect(claudeMessageBatchResultsPath("msgbatch_1")).toBe("/v1/messages/batches/msgbatch_1/results");
    expect(claudeMessageBatchPath("a b")).toContain("a%20b");
  });
});

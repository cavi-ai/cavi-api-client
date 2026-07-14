import type { RunStreamEvent } from "@cavi-ai/api-client/core/runtime";

export const streamEventFixture: RunStreamEvent = {
  event: "message.delta",
  runId: "run_docs_123",
  delta: "Summary",
};

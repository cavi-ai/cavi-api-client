import type { RuntimeRunStartBody } from "@cavi-ai/api-client/core/runtime";

export const runtimeRequestFixture: RuntimeRunStartBody = {
  input: "Summarize the attached document.",
  metadata: { source: "documentation-fixture" },
};

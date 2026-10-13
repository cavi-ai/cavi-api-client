import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAnthropicMessageParams, mapAnthropicMessageToRunStatus } from "../../../providers/claude/message.js";
import { buildCodexResponseBody, mapOpenAIResponseToRunStatus } from "../../../providers/codex/response.js";
import { buildAgyRequestBody } from "../../../providers/agy/request.js";
import { mapAgyResponseToRunStatus } from "../../../providers/agy/response.js";
import type { RuntimeRunStartBody } from "../../../core/runtime/run.js";

const cases = JSON.parse(readFileSync("python/tests/lifecycle-cases.json", "utf8")) as Array<{
  provider: string; body: RuntimeRunStartBody; request: Record<string, unknown>;
  response: Record<string, unknown>; run: Record<string, unknown>;
}>;

describe("shared Python and TypeScript lifecycle contracts", () => {
  for (const fixture of cases) {
    it(fixture.provider, () => {
      if (fixture.provider === "claude-sdk") {
        expect(buildAnthropicMessageParams(fixture.body, { defaultMaxTokens: 4096 })).toEqual(fixture.request);
        expect(mapAnthropicMessageToRunStatus(fixture.response as { id: string })).toEqual(fixture.run);
      } else if (fixture.provider === "codex-responses") {
        expect(buildCodexResponseBody(fixture.body, "model", { background: true, store: true })).toEqual(fixture.request);
        expect(mapOpenAIResponseToRunStatus(fixture.response as { id: string })).toEqual(fixture.run);
      } else {
        expect(buildAgyRequestBody(fixture.body).payload).toEqual(fixture.request);
        expect(mapAgyResponseToRunStatus("model", fixture.response, "fallback")).toEqual(fixture.run);
      }
    });
  }
});

import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import type { RuntimeRunStatus } from "../../core/runtime/run.js";
import { flattenGeminiUsageMetadata } from "./usage.js";

export type GeminiPart = { text?: string };
export type GeminiCandidate = {
  content?: { role?: string; parts?: GeminiPart[] };
  finishReason?: string;
};
export type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: Record<string, unknown>;
  modelVersion?: string;
};

function newGeminiRunId(): string {
  return `gemini-${globalThis.crypto.randomUUID()}`;
}

/** Map a Gemini generateContent response to the universal run status. */
export function mapGeminiGenerateContentToRunStatus(
  model: string,
  response: GeminiGenerateContentResponse,
): RuntimeRunStatus {
  const candidate = response.candidates?.[0];
  const output = (candidate?.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
  const blockReason = response.promptFeedback?.blockReason;
  const finishReason = candidate?.finishReason;
  const failed =
    Boolean(blockReason) ||
    !candidate ||
    (finishReason != null && finishReason !== "STOP" && finishReason !== "MAX_TOKENS");
  const usage = flattenGeminiUsageMetadata(response.usageMetadata);
  const tokens = normalizeRuntimeUsage(usage, "gemini");

  const status: RuntimeRunStatus = {
    run_id: newGeminiRunId(),
    status: failed ? "failed" : "completed",
    model: response.modelVersion ?? model,
  };
  if (output) status.output = output;
  if (failed) status.error = blockReason ?? finishReason ?? "gemini generation failed";
  if (usage) status.usage = usage;
  if (tokens) status.tokens = tokens;
  return status;
}

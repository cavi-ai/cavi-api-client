import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";

export type AnthropicContentBlock = { type: string; text?: string };
export type AnthropicMessage = {
  id: string;
  model?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: Record<string, number>;
};

/** Build the Anthropic Messages `params` from the universal run-start body. */
export function buildAnthropicMessageParams(
  body: RuntimeRunStartBody,
  defaults: { defaultModel?: string; defaultMaxTokens: number },
): Record<string, unknown> {
  const model = body.model ?? defaults.defaultModel;
  if (!model) {
    throw new ApiClientError(
      "claude-sdk: a model is required (pass body.model or defaultModel)",
      { code: ApiClientErrorCode.ValidationFailed },
    );
  }
  const messages = Array.isArray(body.input)
    ? body.input
    : [{ role: "user", content: body.input }];
  const maxTokens =
    typeof body.metadata?.max_tokens === "number"
      ? (body.metadata.max_tokens as number)
      : defaults.defaultMaxTokens;

  const params: Record<string, unknown> = { model, max_tokens: maxTokens, messages };
  if (body.instructions) params.system = body.instructions;
  if (body.tools?.length) params.tools = body.tools;
  return params;
}

/** Map an Anthropic Message to the canonical run status (incl. normalized tokens). */
export function mapAnthropicMessageToRunStatus(message: AnthropicMessage): RuntimeRunStatus {
  const output = (message.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");
  const tokens = normalizeRuntimeUsage(message.usage, "claude-sdk");
  return {
    run_id: message.id,
    status: message.stop_reason ? "completed" : "running",
    ...(message.model ? { model: message.model } : {}),
    ...(output ? { output } : {}),
    ...(message.usage ? { usage: message.usage } : {}),
    ...(tokens ? { tokens } : {}),
  };
}

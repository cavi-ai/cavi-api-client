import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type { RuntimeRunStartBody } from "../../core/runtime/run.js";

function toParts(content: unknown): unknown[] {
  if (typeof content === "string") return [{ text: content }];
  if (Array.isArray(content)) return content;
  return [];
}

function textOfParts(parts: unknown[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
      out.push((part as { text: string }).text);
    }
  }
  return out;
}

/**
 * Build the Gemini request body from the universal run-start body. Full role
 * fidelity: `system`-role array messages and `instructions` both feed
 * `systemInstruction`; `assistant`->`model`, everything else->`user`. Throws
 * ValidationFailed if no model is resolvable.
 */
export function buildGeminiRequestBody(
  body: RuntimeRunStartBody,
  defaultModel?: string,
): { model: string; payload: Record<string, unknown> } {
  const model = body.model ?? defaultModel;
  if (!model) {
    throw new ApiClientError("gemini: a model is required (pass body.model or defaultModel)", {
      code: ApiClientErrorCode.ValidationFailed,
    });
  }

  const systemParts: { text: string }[] = [];
  if (body.instructions) systemParts.push({ text: body.instructions });

  const contents: { role: string; parts: unknown[] }[] = [];
  if (typeof body.input === "string") {
    contents.push({ role: "user", parts: [{ text: body.input }] });
  } else {
    for (const message of body.input) {
      const parts = toParts(message.content);
      if (message.role === "system") {
        for (const text of textOfParts(parts)) systemParts.push({ text });
        continue;
      }
      const role = message.role === "assistant" || message.role === "model" ? "model" : "user";
      contents.push({ role, parts });
    }
  }

  const payload: Record<string, unknown> = { contents };
  if (systemParts.length) payload.systemInstruction = { parts: systemParts };
  if (body.tools?.length) payload.tools = body.tools;
  const generationConfig = (body.metadata as Record<string, unknown> | undefined)?.generationConfig;
  if (generationConfig && typeof generationConfig === "object") payload.generationConfig = generationConfig;

  return { model, payload };
}

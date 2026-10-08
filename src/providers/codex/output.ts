/** Preserve explicit SDK text; otherwise concatenate native message text in wire order. */
export function readCodexOutputText(response: { output_text?: unknown; output?: unknown }): string | undefined {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return undefined;

  const texts: string[] = [];
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const message = item as Record<string, unknown>;
    if (message.type !== "message" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!part || typeof part !== "object") continue;
      const content = part as Record<string, unknown>;
      if (content.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }
  return texts.join("") || undefined;
}

/**
 * Flatten an OpenAI Responses `usage` object into a flat numeric record,
 * lifting one level of nested `*_details` numbers (e.g.
 * `input_tokens_details.cached_tokens` -> `cached_tokens`) so downstream
 * normalization can read them.
 */
export function flattenOpenAIUsage(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number") {
      out[key] = raw;
    } else if (raw && typeof raw === "object") {
      for (const [subKey, subRaw] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof subRaw === "number") out[subKey] = subRaw;
      }
    }
  }
  return Object.keys(out).length ? out : undefined;
}

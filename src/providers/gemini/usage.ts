/**
 * Flatten Gemini `usageMetadata` into a flat numeric record. usageMetadata is a
 * flat object of token counts (promptTokenCount, candidatesTokenCount,
 * totalTokenCount, cachedContentTokenCount?); newer responses add nested
 * `*Details` arrays which are not named counts and are ignored. The core
 * `normalizeRuntimeUsage` already aliases the Gemini keys.
 */
export function flattenGeminiUsageMetadata(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number") out[key] = raw;
  }
  return Object.keys(out).length ? out : undefined;
}

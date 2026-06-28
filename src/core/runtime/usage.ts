/** Canonical, provider-agnostic token usage for a single run. */
export type RuntimeUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** Tokens served from prompt cache. */
  cacheReadTokens?: number;
  /** Tokens written to prompt cache (Anthropic "cache_creation"). */
  cacheWriteTokens?: number;
  /** Lossless provider-native numeric fields, flattened. */
  raw?: Record<string, number>;
};

/** Per-million-token prices supplied by the consumer. No defaults ship. */
export type TokenPrices = {
  inputPerMTok?: number;
  outputPerMTok?: number;
  cacheReadPerMTok?: number;
  cacheWritePerMTok?: number;
};

const PER_MILLION = 1_000_000;

/**
 * Estimate run cost from normalized usage + consumer-supplied prices. The
 * package ships NO price table — prices are always the caller's. Any missing
 * token count or price contributes 0.
 */
export function estimateUsageCost(usage: RuntimeUsage, prices: TokenPrices): number {
  const line = (tokens: number | undefined, price: number | undefined): number =>
    typeof tokens === "number" && typeof price === "number"
      ? (tokens * price) / PER_MILLION
      : 0;
  return (
    line(usage.inputTokens, prices.inputPerMTok) +
    line(usage.outputTokens, prices.outputPerMTok) +
    line(usage.cacheReadTokens, prices.cacheReadPerMTok) +
    line(usage.cacheWriteTokens, prices.cacheWritePerMTok)
  );
}

// Recognized native key aliases per concept (snake_case + camelCase across
// providers). First match wins.
const INPUT_KEYS = ["input_tokens", "inputTokens", "prompt_tokens", "promptTokenCount"];
const OUTPUT_KEYS = ["output_tokens", "outputTokens", "completion_tokens", "candidatesTokenCount"];
const TOTAL_KEYS = ["total_tokens", "totalTokens", "totalTokenCount"];
const CACHE_READ_KEYS = [
  "cache_read_input_tokens",
  "cached_tokens",
  "cacheReadTokens",
  "cachedContentTokenCount",
];
const CACHE_WRITE_KEYS = ["cache_creation_input_tokens", "cacheWriteTokens"];

function pick(raw: Record<string, number>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (typeof raw[key] === "number") return raw[key];
  }
  return undefined;
}

/**
 * Normalize a flat provider-native usage record into RuntimeUsage. Tolerant of
 * snake_case / camelCase across providers. Provider mappers are preferred where
 * the native (possibly nested) object is in hand; this covers callers holding
 * only the legacy flat `RuntimeRunStatus.usage`. `providerKind` is reserved for
 * future provider-specific disambiguation.
 */
export function normalizeRuntimeUsage(
  raw: Record<string, number> | undefined,
  providerKind: string,
): RuntimeUsage | undefined {
  void providerKind;
  if (!raw || typeof raw !== "object") return undefined;
  const numericRaw: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number") numericRaw[key] = value;
  }
  if (Object.keys(numericRaw).length === 0) return undefined;

  const inputTokens = pick(numericRaw, INPUT_KEYS);
  const outputTokens = pick(numericRaw, OUTPUT_KEYS);
  const totalKeyed = pick(numericRaw, TOTAL_KEYS);
  const totalTokens =
    totalKeyed ??
    (typeof inputTokens === "number" && typeof outputTokens === "number"
      ? inputTokens + outputTokens
      : undefined);
  const cacheReadTokens = pick(numericRaw, CACHE_READ_KEYS);
  const cacheWriteTokens = pick(numericRaw, CACHE_WRITE_KEYS);

  const usage: RuntimeUsage = { raw: numericRaw };
  if (inputTokens !== undefined) usage.inputTokens = inputTokens;
  if (outputTokens !== undefined) usage.outputTokens = outputTokens;
  if (totalTokens !== undefined) usage.totalTokens = totalTokens;
  if (cacheReadTokens !== undefined) usage.cacheReadTokens = cacheReadTokens;
  if (cacheWriteTokens !== undefined) usage.cacheWriteTokens = cacheWriteTokens;
  return usage;
}

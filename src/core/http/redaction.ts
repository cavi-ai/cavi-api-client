/**
 * Single source of truth for scrubbing secrets out of values, text, and config
 * keys before they are logged, previewed, or rendered.
 *
 * Gateway-agnostic: the same sensitivity rule governs HTTP request/response
 * previews and config-path filtering so the two can never drift apart.
 */

export const REDACTION_PLACEHOLDER = "[REDACTED]";
export const DEFAULT_PREVIEW_MAX_CHARS = 12_000;

/**
 * Matches a key segment that names a credential. Segments may be separated by
 * `.`, `_`, or `-` (e.g. `model.api_key`, `auth-token`, `refreshToken`).
 */
export const SENSITIVE_KEY_PATTERN =
  /(^|[._-])(api[_-]?key|secret|password|private[_-]?key|credential|authorization|auth[_-]?token|access[_-]?token|refresh[_-]?token|token|cookie)([._-]|$)/iu;

const SENSITIVE_TEXT_PATTERN =
  /((?:api[_-]?key|secret|password|private[_-]?key|credential|authorization|auth[_-]?token|access[_-]?token|refresh[_-]?token|token|cookie)["']?\s*[:=]\s*["']?)([^"',}\]\s&]+)/giu;

const BEARER_TOKEN_PATTERN = /(Bearer\s+)([A-Za-z0-9._~+/=-]+)/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValue(entry));
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? REDACTION_PLACEHOLDER : redactSensitiveValue(entry),
    ]),
  );
}

export function redactSensitiveText(text: string): string {
  return text
    .replace(SENSITIVE_TEXT_PATTERN, `$1${REDACTION_PLACEHOLDER}`)
    .replace(BEARER_TOKEN_PATTERN, `$1${REDACTION_PLACEHOLDER}`);
}

function truncate(raw: string, maxChars: number): string {
  return raw.length > maxChars ? `${raw.slice(0, maxChars)}...[truncated]` : raw;
}

export function stringifyRedacted(
  value: unknown,
  maxChars = DEFAULT_PREVIEW_MAX_CHARS,
): string | undefined {
  if (value === undefined) return undefined;
  try {
    const raw =
      typeof value === "string"
        ? redactSensitiveText(value)
        : JSON.stringify(redactSensitiveValue(value));
    return truncate(raw, maxChars);
  } catch {
    return "[unserializable body]";
  }
}

export function redactPreviewText(
  text: string,
  maxChars = DEFAULT_PREVIEW_MAX_CHARS,
): string {
  return truncate(redactSensitiveText(text), maxChars);
}

export class CaviControlApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "CaviControlApiError";
    this.status = status;
    this.code = code;
  }
}

function cleanErrorText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().replace(/\s+/gu, " ");
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 180);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractGatewayErrorDetails(payload: unknown): {
  message: string | null;
  code: string | null;
} {
  const record = asRecord(payload);
  const errorRecord = asRecord(record?.error);

  const message =
    cleanErrorText(errorRecord?.message) ??
    cleanErrorText(record?.message) ??
    null;
  const code =
    cleanErrorText(errorRecord?.code) ??
    cleanErrorText(record?.code) ??
    null;

  return { message, code };
}

export function parseGatewayErrorText(
  text: string,
  contentType: string,
): {
  message: string | null;
  code: string | null;
} {
  if (!contentType.toLowerCase().includes("application/json")) {
    return { message: null, code: null };
  }

  try {
    return extractGatewayErrorDetails(JSON.parse(text) as unknown);
  } catch {
    return { message: null, code: null };
  }
}

export function buildGatewayHttpError(params: {
  label: string;
  status: number;
  statusText: string;
  message?: string | null;
  code?: string | null;
}): CaviControlApiError {
  const statusText = cleanErrorText(params.statusText);
  const detail = cleanErrorText(params.message);
  const code = cleanErrorText(params.code);

  const base = statusText
    ? `${params.label} ${params.status}: ${statusText}`
    : `${params.label} ${params.status}`;
  const withCode = code ? `${base} [${code}]` : base;
  const message =
    detail && detail !== statusText ? `${withCode} - ${detail}` : withCode;

  return new CaviControlApiError(message, params.status, code);
}

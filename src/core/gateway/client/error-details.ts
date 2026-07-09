import { redactPreviewText } from "../../http/redaction.js";

export function cleanGatewayErrorText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().replace(/\s+/gu, " ");
  if (!trimmed) {
    return null;
  }
  return redactPreviewText(trimmed, 180);
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
    cleanGatewayErrorText(errorRecord?.message) ??
    cleanGatewayErrorText(record?.message) ??
    cleanGatewayErrorText(record?.error) ??
    null;
  const code =
    cleanGatewayErrorText(errorRecord?.code) ??
    cleanGatewayErrorText(record?.code) ??
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

export function formatGatewayHttpErrorMessage(params: {
  label: string;
  status: number;
  statusText: string;
  message?: string | null;
  code?: string | null;
}): string {
  const label = cleanGatewayErrorText(params.label) ?? "Gateway API";
  const statusText = cleanGatewayErrorText(params.statusText);
  const detail = cleanGatewayErrorText(params.message);
  const code = cleanGatewayErrorText(params.code);

  const base = statusText
    ? `${label} ${params.status}: ${statusText}`
    : `${label} ${params.status}`;
  const withCode = code ? `${base} [${code}]` : base;
  return detail && detail !== statusText
    ? `${withCode} - ${detail}`
    : withCode;
}

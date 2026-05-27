import { LIBRARY_API_ENDPOINTS, resolveLibraryApiPath } from "../contracts/paths.js";
import { resolveCaviPath } from "../contracts/resolve.js";
import { getErrorMessage } from "../../../core/errors.js";

export const LIBRARY_CLIP_ENDPOINT = LIBRARY_API_ENDPOINTS.clip;
export const LIBRARY_CLIP_HEALTH_ENDPOINT = LIBRARY_API_ENDPOINTS.clipHealth;
export const LIBRARY_CLIP_SCHEMA_ENDPOINT = LIBRARY_API_ENDPOINTS.clipSchema;
export const LIBRARY_CLIP_LOGS_ENDPOINT = LIBRARY_API_ENDPOINTS.clipLogs;
export const LIBRARY_CLIP_DEFAULT_TEAM = "library";
export const LIBRARY_CLIP_SOURCE_TAG = "caviclip";

export type LibraryClipInput = {
  title?: string | null;
  sourceUrl?: string | null;
  text?: string | null;
  team?: string | null;
  tags?: readonly string[] | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  capturedAt?: string | null;
};

export type LibraryClipRequest = {
  title: string;
  team: string;
  tags: string[];
  note: string;
  source_url?: string;
  text?: string;
  metadata: Record<string, unknown>;
};

export type LibraryClipResult = {
  accepted?: boolean;
  id?: string;
  clip_id?: string;
  jobId?: string;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
  [key: string]: unknown;
};

export type LibraryClipTransport = <T>(
  path: string,
  init?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    timeoutMs?: number;
  },
) => Promise<T>;

export type LibraryClipSchemaField = {
  type: string;
  required: boolean;
  description: string;
};

export type LibraryClipSchemaSnapshot = {
  contract: "LIBRARY_CLIP_V1";
  endpoint: typeof LIBRARY_CLIP_ENDPOINT;
  method: "POST";
  fields: Record<keyof LibraryClipRequest, LibraryClipSchemaField>;
  example: LibraryClipRequest;
};

export type LibraryClipDiagnosticsCheck = {
  id: "clip-endpoint" | "pipeline-status" | "clip-health" | "clip-schema" | "clip-logs";
  label: string;
  path: string;
  ok: boolean;
  status?: number;
  message: string;
  source: "local-contract" | "gateway";
};

export type LibraryClipDiagnosticsLog = {
  at?: string;
  level?: string;
  message: string;
  path?: string;
};

export type LibraryClipDiagnosticsSnapshot = {
  fetchedAt: number;
  endpoint: typeof LIBRARY_CLIP_ENDPOINT;
  schema: LibraryClipSchemaSnapshot | Record<string, unknown>;
  schemaSource: "local-contract" | "gateway";
  checks: LibraryClipDiagnosticsCheck[];
  logs: LibraryClipDiagnosticsLog[];
};

export type LibraryManualFileClipInput = {
  name: string;
  uri?: string | null;
  mimeType?: string | null;
  size?: number | null;
  text?: string | null;
  capturedAt?: string | null;
};

function cleanString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function statusFromError(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

function messageFromError(error: unknown): string {
  return getErrorMessage(error);
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function titleFromUrl(sourceUrl: string): string | undefined {
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.host.trim();
    if (host) return host;
  } catch {
    return undefined;
  }
  return undefined;
}

function titleFromText(text: string): string | undefined {
  const firstLine = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return undefined;
  return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine;
}

export function buildLibraryClipPayload(input: LibraryClipInput): LibraryClipRequest {
  const sourceUrl = cleanString(input.sourceUrl);
  const text = cleanString(input.text);
  if (!sourceUrl && !text) {
    throw new Error("Library clip requires a sourceUrl or text value.");
  }

  const title =
    cleanString(input.title) ??
    (sourceUrl ? titleFromUrl(sourceUrl) : undefined) ??
    (text ? titleFromText(text) : undefined) ??
    "CaviClip";
  const team = cleanString(input.team) ?? LIBRARY_CLIP_DEFAULT_TEAM;
  const tags = uniqueStrings([
    LIBRARY_CLIP_SOURCE_TAG,
    ...(input.tags ?? []),
  ]);
  const capturedAt = cleanString(input.capturedAt) ?? new Date().toISOString();
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    source: LIBRARY_CLIP_SOURCE_TAG,
    captured_at: capturedAt,
  };

  return {
    title,
    team,
    tags,
    note: cleanString(input.note) ?? "Captured from CaviClip.",
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    ...(text ? { text } : {}),
    metadata,
  };
}

export function buildLibraryClipSchemaSnapshot(): LibraryClipSchemaSnapshot {
  return {
    contract: "LIBRARY_CLIP_V1",
    endpoint: LIBRARY_CLIP_ENDPOINT,
    method: "POST",
    fields: {
      title: {
        type: "string",
        required: true,
        description: "Human-readable title for the captured URL, text, or manual file smoke.",
      },
      team: {
        type: "string",
        required: true,
        description: "Library team routing key. Defaults to library/Sigmund intake.",
      },
      tags: {
        type: "string[]",
        required: true,
        description: "Deduplicated tags. The caviclip source tag is always included.",
      },
      note: {
        type: "string",
        required: true,
        description: "Operator-facing note attached to the clip.",
      },
      source_url: {
        type: "string",
        required: false,
        description: "Original URL when the clip comes from a web share.",
      },
      text: {
        type: "string",
        required: false,
        description: "Captured body text or manual file smoke content.",
      },
      metadata: {
        type: "object",
        required: true,
        description: "Non-secret ingress metadata for diagnostics and routing.",
      },
    },
    example: buildLibraryClipPayload({
      title: "CaviClip diagnostic",
      text: "Manual CaviClip diagnostic clip.",
      tags: ["diagnostic"],
      capturedAt: "2026-05-21T12:00:00.000Z",
      metadata: { ingress: "sigmund-portal" },
    }),
  };
}

export function buildLibraryManualFileClipInput(
  input: LibraryManualFileClipInput,
): LibraryClipInput {
  const name = cleanString(input.name) ?? "manual-file";
  const text = cleanString(input.text);
  const size = typeof input.size === "number" && Number.isFinite(input.size)
    ? input.size
    : null;
  const mimeType = cleanString(input.mimeType);
  const uri = cleanString(input.uri);
  const fallbackText = [
    `Manual CaviClip file ingest smoke for ${name}.`,
    mimeType ? `MIME: ${mimeType}` : null,
    size !== null ? `Size: ${size} bytes` : null,
    "File content was not embedded because the file is binary, empty, or over the mobile diagnostic limit.",
  ].filter(Boolean).join("\n");

  return {
    title: name,
    text: text ?? fallbackText,
    team: LIBRARY_CLIP_DEFAULT_TEAM,
    tags: ["manual-test", "file"],
    note: "Manual file ingest smoke from Sigmund CaviClip diagnostics.",
    capturedAt: input.capturedAt,
    metadata: {
      ingress: "sigmund-portal-manual-file",
      file: {
        name,
        ...(uri ? { uri } : {}),
        ...(mimeType ? { mime_type: mimeType } : {}),
        ...(size !== null ? { size } : {}),
        content_included: Boolean(text),
      },
    },
  };
}

export function postLibraryClip<T extends LibraryClipResult = LibraryClipResult>(
  requestJson: LibraryClipTransport,
  input: LibraryClipInput,
  opts?: { timeoutMs?: number },
): Promise<T> {
  // Resolve through the surface contract instead of hardcoding the endpoint,
  // matching every other CAVI surface.
  return requestJson<T>(resolveCaviPath("library.clip"), {
    method: "POST",
    body: buildLibraryClipPayload(input),
    timeoutMs: opts?.timeoutMs,
  });
}

async function optionalGet(
  requestJson: LibraryClipTransport,
  id: LibraryClipDiagnosticsCheck["id"],
  label: string,
  path: string,
): Promise<{ check: LibraryClipDiagnosticsCheck; payload: unknown | null }> {
  try {
    const payload = await requestJson<unknown>(path, { method: "GET" });
    return {
      payload,
      check: {
        id,
        label,
        path,
        ok: true,
        message: "reachable",
        source: "gateway",
      },
    };
  } catch (error) {
    const status = statusFromError(error);
    return {
      payload: null,
      check: {
        id,
        label,
        path,
        ok: false,
        ...(status !== undefined ? { status } : {}),
        message: messageFromError(error),
        source: "gateway",
      },
    };
  }
}

function normalizeDiagnosticsLogs(payload: unknown): LibraryClipDiagnosticsLog[] {
  const root = asRecord(payload);
  const source = Array.isArray(root.logs)
    ? root.logs
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(payload)
        ? payload
        : [];
  return source
    .map((entry) => {
      const record = asRecord(entry);
      const message =
        cleanString(record.message as string | null | undefined) ??
        cleanString(record.event as string | null | undefined) ??
        cleanString(record.error as string | null | undefined);
      if (!message) return null;
      return {
        ...(cleanString(record.at as string | null | undefined) ? { at: cleanString(record.at as string | null | undefined) } : {}),
        ...(cleanString(record.level as string | null | undefined) ? { level: cleanString(record.level as string | null | undefined) } : {}),
        message,
        ...(cleanString(record.path as string | null | undefined) ? { path: cleanString(record.path as string | null | undefined) } : {}),
      };
    })
    .filter((entry): entry is LibraryClipDiagnosticsLog => entry !== null)
    .slice(0, 25);
}

export async function requestLibraryClipDiagnostics(
  requestJson: LibraryClipTransport,
): Promise<LibraryClipDiagnosticsSnapshot> {
  const [pipeline, health, schema, logs] = await Promise.all([
    optionalGet(requestJson, "pipeline-status", "Pipeline status", resolveLibraryApiPath("status")),
    optionalGet(requestJson, "clip-health", "CaviClip health", LIBRARY_CLIP_HEALTH_ENDPOINT),
    optionalGet(requestJson, "clip-schema", "CaviClip schema", LIBRARY_CLIP_SCHEMA_ENDPOINT),
    optionalGet(requestJson, "clip-logs", "CaviClip logs", LIBRARY_CLIP_LOGS_ENDPOINT),
  ]);
  const remoteSchema = schema.check.ok && Object.keys(asRecord(schema.payload)).length > 0
    ? asRecord(schema.payload)
    : null;

  return {
    fetchedAt: Date.now(),
    endpoint: LIBRARY_CLIP_ENDPOINT,
    schema: remoteSchema ?? buildLibraryClipSchemaSnapshot(),
    schemaSource: remoteSchema ? "gateway" : "local-contract",
    checks: [
      {
        id: "clip-endpoint",
        label: "Clip endpoint",
        path: LIBRARY_CLIP_ENDPOINT,
        ok: true,
        message: "POST contract loaded from canonical package",
        source: "local-contract",
      },
      pipeline.check,
      health.check,
      schema.check,
      logs.check,
    ],
    logs: normalizeDiagnosticsLogs(logs.payload),
  };
}

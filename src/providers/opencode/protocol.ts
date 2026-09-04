import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../core/errors.js";

/** The OpenCode server release whose legacy HTTP/SSE contract is supported. */
export const OPENCODE_SERVER_VERSION = "1.18.27" as const;

/** SHA-256 of the verified live OpenCode OpenAPI document. */
export const OPENCODE_OPENAPI_SHA256 =
  "46db986090aae41846cd6dbe16225a1d883f0bbcb4c48814008d3f6ce140aa5c" as const;

/** The route and transport family used by `opencode serve`. */
export const OPENCODE_ENDPOINT_FAMILY = "legacy-http-sse" as const;

export type OpenCodeScope = {
  directory: string;
  workspace?: string;
};

function validationError(message: string): ApiClientError {
  return new ApiClientError(`opencode: ${message}`, {
    type: ApiClientErrorType.Validation,
    code: ApiClientErrorCode.ValidationFailed,
  });
}

function isAbsoluteDirectory(value: string): boolean {
  // POSIX paths (including the POSIX spelling of a UNC path).
  if (value.startsWith("/")) {
    return true;
  }
  // Windows drive-absolute paths, e.g. C:\\workspace or D:/workspace.
  if (/^[A-Za-z]:[\\/]/u.test(value)) {
    return true;
  }
  // Windows UNC paths, e.g. \\\\server\\share.
  return /^\\\\[^\\/]+[\\/][^\\/]+/u.test(value);
}

/**
 * Validate a request scope while preserving the caller's path strings exactly.
 * Whitespace is used only for presence checks; path normalization is not part
 * of the OpenCode protocol contract.
 */
export function validateOpenCodeScope(scope: unknown): OpenCodeScope {
  if (typeof scope !== "object" || scope === null || Array.isArray(scope)) {
    throw validationError("scope must be an object");
  }

  const candidate = scope as Record<string, unknown>;
  const directory = candidate.directory;
  if (typeof directory !== "string" || !directory.trim()) {
    throw validationError("directory is required");
  }
  if (!isAbsoluteDirectory(directory.trim())) {
    throw validationError("directory must be absolute");
  }

  const workspace = candidate.workspace;
  if (workspace !== undefined && (typeof workspace !== "string" || !workspace.trim())) {
    throw validationError("workspace must be nonblank when supplied");
  }

  return workspace === undefined ? { directory } : { directory, workspace: workspace as string };
}

/** Validate and URL-encode a dynamic OpenCode session identifier. */
export function encodeOpenCodeSessionId(sessionId: unknown): string {
  if (typeof sessionId !== "string" || !sessionId.trim() || !sessionId.startsWith("ses_")) {
    throw validationError("session ID must be a nonblank string beginning with ses_");
  }
  return encodeURIComponent(sessionId);
}

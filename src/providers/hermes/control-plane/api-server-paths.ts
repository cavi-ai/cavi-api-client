export const HERMES_NATIVE_SESSIONS_PATH = "/api/sessions";

export function hermesNativeSessionsPath(limit: number, offset: number): string {
  return `${HERMES_NATIVE_SESSIONS_PATH}?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`;
}

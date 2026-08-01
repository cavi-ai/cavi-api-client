export const AGY_API_BASE_URL = "http://localhost:8000";

export function agyRunPath(): string {
  return `/v1/agents/run`;
}

export function agyStreamPath(): string {
  return `/v1/agents/stream`;
}

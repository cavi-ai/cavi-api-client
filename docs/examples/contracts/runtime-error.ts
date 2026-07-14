import { ApiClientError } from "@cavi-ai/api-client/core/errors";

export function isApiClientError(value: unknown): value is ApiClientError {
  return value instanceof ApiClientError;
}

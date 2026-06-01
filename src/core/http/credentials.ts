/** Auth headers a credential resolver contributes to a request. */
export type CredentialHeaders = Record<string, string>;

/**
 * Provider-supplied auth scheme. Returns the headers to merge onto a request.
 * Closes over whatever secret the provider needs (token, api key, cookie).
 */
export type CredentialResolver = () => CredentialHeaders;

/** Standard bearer scheme. Emits nothing when the token is empty. */
export function bearerCredentials(token: string | null | undefined): CredentialResolver {
  const trimmed = token?.trim() ?? "";
  return () => {
    const headers: CredentialHeaders = {};
    if (trimmed) {
      headers.Authorization = `Bearer ${trimmed}`;
    }
    return headers;
  };
}

export type ApiKeyCredentialOptions = {
  /** Header name for the key. Defaults to "Authorization". */
  header?: string;
  /** Extra static headers (e.g. { "anthropic-version": "2023-06-01" }). */
  extra?: Record<string, string>;
};

/** API-key scheme (e.g. Anthropic: header "x-api-key" + "anthropic-version"). */
export function apiKeyCredentials(
  key: string,
  options: ApiKeyCredentialOptions = {},
): CredentialResolver {
  const header = options.header?.trim() || "Authorization";
  const extra = options.extra ?? {};
  return () => (key ? { [header]: key, ...extra } : { ...extra });
}

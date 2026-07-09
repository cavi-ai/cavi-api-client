// Managed Agents webhook verification + typed payloads.
//
// Verification follows the Standard Webhooks spec — the scheme the Anthropic SDK
// uses (its `webhooks.unwrap()` is `import { Webhook } from "standardwebhooks"`,
// confirmed from the SDK source). The platform docs name only `X-Webhook-Signature`;
// the SDK is authoritative, so we read the standard `webhook-id` /
// `webhook-timestamp` / `webhook-signature` headers and accept `svix-*` / `x-webhook-*`
// aliases for robustness.
//
// Scheme: signed content = `${id}.${timestamp}.${rawBody}`; key = base64-decode of
// the secret after the `whsec_` prefix; HMAC-SHA256 → base64; the signature header is
// a space-delimited list of `v1,<base64sig>` (any match passes); 5-minute tolerance.
// Implemented with Web Crypto so it runs on Node 20+ and the browser without a dep.

/** Webhook `data.type` values Anthropic emits. */
export const MANAGED_AGENT_WEBHOOK_EVENT_TYPES = [
  "session.status_scheduled",
  "session.status_run_started",
  "session.status_idled",
  "session.status_rescheduled",
  "session.status_terminated",
  "session.thread_created",
  "session.thread_idled",
  "session.thread_terminated",
  "session.outcome_evaluation_ended",
  "agent.created",
  "agent.updated",
  "agent.archived",
  "agent.deleted",
  "deployment.created",
  "deployment.updated",
  "deployment.paused",
  "deployment.unpaused",
  "deployment.archived",
  "deployment.deleted",
  "deployment_run.started",
  "deployment_run.succeeded",
  "deployment_run.failed",
  "vault.created",
  "vault.archived",
  "vault.deleted",
  "vault_credential.created",
  "vault_credential.archived",
  "vault_credential.deleted",
  "vault_credential.refresh_failed",
] as const;

export type ManagedAgentWebhookEventType =
  | (typeof MANAGED_AGENT_WEBHOOK_EVENT_TYPES)[number]
  | (string & {});

/** Thin webhook payload — fetch the resource by `data.id` for current state. */
export type ManagedAgentWebhookEvent = {
  type: "event";
  /** Unique per event (not per delivery) — dedupe retries on this. */
  id: string;
  created_at: string;
  data: {
    type: ManagedAgentWebhookEventType;
    id: string;
    organization_id?: string;
    workspace_id?: string;
    [key: string]: unknown;
  };
};

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export type WebhookHeaders = Record<string, string | string[] | undefined> | Headers;

export type VerifyWebhookOptions = {
  /** Timestamp tolerance in seconds (default 300 = 5 minutes). */
  toleranceSeconds?: number;
  /** Override "now" (ms since epoch) — for testing. */
  nowMs?: number;
};

const DEFAULT_TOLERANCE_SECONDS = 300;

function readHeader(headers: WebhookHeaders, name: string): string | undefined {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === lower) {
      return Array.isArray(value) ? value[0] : (value as string | undefined);
    }
  }
  return undefined;
}

function firstHeader(headers: WebhookHeaders, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = readHeader(headers, name);
    if (value) return value;
  }
  return undefined;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function hmacSha256Base64(keyBytes: Uint8Array, message: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new WebhookVerificationError("Web Crypto (crypto.subtle) is unavailable in this runtime");
  }
  const key = await subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

/** Parse a webhook body without verifying — only when verification happens elsewhere. */
export function parseWebhookEvent(rawBody: string): ManagedAgentWebhookEvent {
  return JSON.parse(rawBody) as ManagedAgentWebhookEvent;
}

/**
 * Verify a Managed Agents webhook delivery and return the parsed event. Throws
 * `WebhookVerificationError` if a header is missing, the timestamp is outside the
 * tolerance window, or no signature matches. Pass the RAW request body bytes as a
 * string — re-serialized JSON changes the bytes and breaks the MAC.
 */
export async function verifyManagedAgentWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  signingSecret: string,
  options: VerifyWebhookOptions = {},
): Promise<ManagedAgentWebhookEvent> {
  const id = firstHeader(headers, ["webhook-id", "svix-id", "x-webhook-id"]);
  const timestamp = firstHeader(headers, ["webhook-timestamp", "svix-timestamp", "x-webhook-timestamp"]);
  const signatureHeader = firstHeader(headers, ["webhook-signature", "svix-signature", "x-webhook-signature"]);
  if (!id || !timestamp || !signatureHeader) {
    throw new WebhookVerificationError("missing webhook id, timestamp, or signature header");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    throw new WebhookVerificationError("invalid webhook timestamp");
  }
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (nowSec - ts > tolerance) throw new WebhookVerificationError("webhook timestamp too old");
  if (ts - nowSec > tolerance) throw new WebhookVerificationError("webhook timestamp too new");

  const secret = signingSecret.startsWith("whsec_") ? signingSecret.slice(6) : signingSecret;
  const expected = await hmacSha256Base64(base64ToBytes(secret), `${id}.${timestamp}.${rawBody}`);

  // The header is a space-delimited list of `<version>,<base64sig>`; any match passes.
  const matched = signatureHeader.split(" ").some((entry) => {
    const comma = entry.indexOf(",");
    const sig = comma >= 0 ? entry.slice(comma + 1) : entry;
    return timingSafeEqual(sig, expected);
  });
  if (!matched) {
    throw new WebhookVerificationError("no matching webhook signature");
  }

  return parseWebhookEvent(rawBody);
}

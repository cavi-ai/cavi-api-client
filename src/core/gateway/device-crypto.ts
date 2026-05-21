// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

// Device identity crypto utilities for the gateway client.
// Uses Web Crypto API (SubtleCrypto) for Ed25519 key generation, signing, and ID derivation.
// Pure functions — no side effects, no storage.

// --- Base64url ---

export function base64UrlEncode(buf: Uint8Array): string {
  let binary = "";
  for (const byte of buf) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Key Generation ---

export async function generateDeviceKeypair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"]);
}

// --- Key Export ---

export async function exportPublicKeyRaw(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

// --- Device ID ---

export async function deriveDeviceId(publicKeyRaw: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", publicKeyRaw as ArrayBufferView<ArrayBuffer>);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Payload ---

function normalizeMetadata(value: string | undefined | null): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  // Must match server's normalizeDeviceMetadataForAuth: ASCII lowercase only.
  return trimmed.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

export function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}): string {
  const scopes = params.scopes.join(",");
  const platform = normalizeMetadata(params.platform);
  const deviceFamily = normalizeMetadata(params.deviceFamily);
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    params.token,
    params.nonce,
    platform,
    deviceFamily,
  ].join("|");
}

// --- Signing ---

export async function signPayload(privateKey: CryptoKey, payload: string): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign("Ed25519", privateKey, encoded);
  return base64UrlEncode(new Uint8Array(signature));
}

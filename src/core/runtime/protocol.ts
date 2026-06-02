import { ApiClientError, ApiClientErrorCode } from "../errors.js";

export type ProtocolVersionCarrier = { protocolVersion?: string | null };

export type ProtocolVersionCheck = {
  ok: boolean;
  expected: string;
  actual: string | null;
};

/** Compare a provider's reported protocol version against the expected one. */
export function checkProtocolVersion(
  carrier: ProtocolVersionCarrier,
  expected: string,
): ProtocolVersionCheck {
  const actual = carrier.protocolVersion?.trim() ? carrier.protocolVersion.trim() : null;
  return { ok: actual === expected, expected, actual };
}

/** Throw a typed ProtocolMismatch error when the reported version is not `expected`. */
export function assertProtocolVersion(
  carrier: ProtocolVersionCarrier,
  expected: string,
): void {
  const result = checkProtocolVersion(carrier, expected);
  if (!result.ok) {
    throw new ApiClientError(
      `protocol version mismatch: expected "${expected}", got "${result.actual ?? "unknown"}"`,
      { code: ApiClientErrorCode.ProtocolMismatch },
    );
  }
}

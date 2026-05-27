export function normalizeGatewayProviderToken(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return normalized === "generic" ? "gateway" : normalized;
}

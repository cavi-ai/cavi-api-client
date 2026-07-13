import type { TransportAuthResolver } from "./types.js";

export async function resolveTransportHeaders(
  defaults: Readonly<Record<string, string>> = {},
  resolver?: TransportAuthResolver,
): Promise<Record<string, string>> {
  const auth = await resolver?.();
  return { ...defaults, ...auth?.headers };
}

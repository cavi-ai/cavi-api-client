import type { TransportAuthResolver } from "./types.js";

export async function resolveTransportHeaders(
  defaults: Readonly<Record<string, string>> = {},
  resolver?: TransportAuthResolver,
): Promise<Record<string, string>> {
  const auth = await resolver?.();
  const headers: Record<string, string> = {};
  for (const source of [defaults, auth?.headers] as const) {
    if (!source) continue;
    for (const [name, value] of Object.entries(source)) {
      const semanticName = name.toLowerCase();
      const previous = Object.keys(headers).find((candidate) => candidate.toLowerCase() === semanticName);
      if (previous !== undefined) delete headers[previous];
      headers[name] = value;
    }
  }
  return headers;
}

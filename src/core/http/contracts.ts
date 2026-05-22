/** Human-readable HTTP contract line for envelopes and diagnostics. */
export function describeHttpContract(
  method: string,
  path: string,
  bodyHint?: string,
): string {
  const base = `${method} ${path}`;
  return bodyHint ? `${base} ${bodyHint}` : base;
}

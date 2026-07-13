import /* static fixture import */ "node:fs";

// Dynamic imports are intentionally outside the static source-graph policy.
void import("node:path");

export const fixtureValue = 1;

export const meta = {
  name: 'health',
  description:
    'Full @cavi-ai/api-client health check: quality gate + API surface diagnosis + repo/version/CI audit, run in parallel and synthesized into one go/no-go report.',
  whenToUse:
    'Before a release or PR, or whenever you want one report covering "is the package green, does its declared API match reality, and is the repo/version/CI state clean".',
  phases: [
    { title: 'Probe', detail: 'quality gate ∥ API diagnosis ∥ repo/version/CI audit (parallel)' },
    { title: 'Synthesize', detail: 'merge into one health report' },
  ],
}

// Commands run from the package root (the session cwd). Each probe is
// independent, so they run concurrently behind a barrier, then one agent
// synthesizes. Nothing here mutates the repo or calls a mutating API.

const GATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pass', 'steps'],
  properties: {
    pass: { type: 'boolean' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'status'],
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'fail'] },
          detail: { type: 'string' },
        },
      },
    },
    notes: { type: 'string' },
  },
}

const DIAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'divergentRestCount', 'nativeDrift', 'summary'],
  properties: {
    ok: { type: 'boolean' },
    divergentRestCount: { type: 'number' },
    nativeDrift: { type: 'string', description: 'clean | skipped | details of drift' },
    live: { type: 'string', description: 'skipped | per-class tallies if a gateway was probed' },
    summary: { type: 'string' },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['branch', 'cleanTree', 'localVersion', 'npmVersion', 'summary'],
  properties: {
    branch: { type: 'string' },
    cleanTree: { type: 'boolean' },
    localVersion: { type: 'string' },
    npmVersion: { type: 'string' },
    latestCiConclusion: { type: 'string' },
    openPrCount: { type: 'number' },
    summary: { type: 'string' },
  },
}

phase('Probe')

const [gate, diagnosis, audit] = await parallel([
  () =>
    agent(
      'You are verifying @cavi-ai/api-client. From the package root run exactly `pnpm run verify` ' +
        '(test + typecheck:docs + build + lint:md + pack --dry-run). Also run `pnpm run typecheck` and ' +
        '`pnpm run typecheck:gate`. Report each step pass/fail with the test count and any first failure line. ' +
        'Do not edit any files.',
      { label: 'gate', phase: 'Probe', schema: GATE_SCHEMA },
    ),
  () =>
    agent(
      'You are diagnosing the @cavi-ai/api-client API surface. From the package root run `pnpm run build` then ' +
        '`node scripts/diagnose.mjs --mode=all --json`. If GATEWAY_URL is unset, live probing is skipped — that is fine. ' +
        'If a native OpenClaw checkout exists at /Volumes/MIRZA/workspace/CAVI/harness/openclaw, re-run static with ' +
        '`OPENCLAW_SOURCE_DIR=/Volumes/MIRZA/workspace/CAVI/harness/openclaw node scripts/diagnose.mjs --mode=static --json` ' +
        'to include native drift. Parse the JSON and report: ok, count of divergent CAVI-compat REST routes, native drift ' +
        '(clean/skipped/details), live (skipped or per-class tallies). Do not edit any files or call mutating APIs.',
      { label: 'diagnose', phase: 'Probe', schema: DIAG_SCHEMA },
    ),
  () =>
    agent(
      'You are auditing repo/release health for @cavi-ai/api-client. Run: `git status --short --branch`; ' +
        '`node -p "require(\'./package.json\').version"`; `npm view @cavi-ai/api-client version`; ' +
        '`gh run list --limit 5`; `gh pr list --state open`. Report branch, whether the tree is clean, local vs npm ' +
        'version, the most recent CI conclusion, and the open-PR count. Read-only; do not edit, push, or merge.',
      { label: 'audit', phase: 'Probe', schema: AUDIT_SCHEMA },
    ),
])

phase('Synthesize')

const summary = await agent(
  'Synthesize ONE health report for @cavi-ai/api-client from these three probe results. Lead with a single ' +
    'GO / NO-GO line, then a short bullet per area (gate, diagnosis, audit). Call out every RED explicitly: a failed ' +
    'gate step, any native drift, any divergent REST that a live probe showed as missing, a dirty tree, or local/npm ' +
    'version mismatch. Facts only, terse.\n\n' +
    `QUALITY GATE: ${JSON.stringify(gate)}\n\n` +
    `DIAGNOSIS: ${JSON.stringify(diagnosis)}\n\n` +
    `AUDIT: ${JSON.stringify(audit)}`,
  { label: 'synthesize', phase: 'Synthesize' },
)

return { gate, diagnosis, audit, summary }

---
name: Diagnose
description: Use to diagnose @cavi-ai/api-client's API surface — confirm which declared routes/RPC methods a live gateway actually serves vs 404/degrade-to-mock, detect drift between the package's declared contract and native OpenClaw source, and gather repo/version/CI/gate health. Use when data looks stale or mock, a surface 404s, paths may have drifted, or before proposing a path/provider change.
---

# Diagnose

A library can't be "data-diagnosed" by clicking a dashboard — you diagnose its
**contract against reality**. The prober reads the package's *own* path tables
and RPC method lists (from `dist/`), so it can never drift from what ships: add a
route or method and it is probed automatically.

The motivating case: a CAVI REST surface was declared here that **no live gateway
serves** (404 → silent mock). Static mode catches exactly that — with no network.

## Run it

```sh
pnpm run build                 # prober imports from dist/ — build first
pnpm run diagnose              # static + live (live auto-skips if no GATEWAY_URL)
pnpm run diagnose:static       # offline only — contract + native-source drift
node scripts/diagnose.mjs --mode=live --json
```

Env:

| Var | Used by | Meaning |
| --- | --- | --- |
| `GATEWAY_URL` | live | `http(s)://` base of a running gateway. Unset ⇒ live skipped. |
| `AUTH_TOKEN` | live | Bearer token (optional). |
| `OPENCLAW_SOURCE_DIR` | static | Path to a native OpenClaw checkout. Set ⇒ drift check runs. |

## Modes

- **static** (offline, CI-safe): inventory of declared routes/RPC; flags
  **CAVI-compat REST** that native OpenClaw has no owner for (the 404→mock risk);
  and, with `OPENCLAW_SOURCE_DIR`, **drift** between our `workboard.*` mirror and
  native source (declared-but-not-native = stale; native-but-not-declared =
  missing coverage). Drift or self-consistency failure ⇒ exit 1.
- **live** (needs `GATEWAY_URL`): probes every declared **static** HTTP route
  with `GET` (never mutating) and a curated set of **read-only** WS RPC methods.
  Classes: `live` 2xx · `auth` 401/403 · `missing` 404 · `served(other-method)`
  405 · `error` 5xx · `unreachable`. Mutating RPCs are listed but never called.
  Live findings are informational (a 404 is data); add `--strict` to fail on
  `missing`/`error`.

## Interpreting

- **`missing` on a declared route** → the package declares a path nobody serves.
  Either the gateway lost it (regression) or we carry a divergent/stale path.
  Fix the path in its `*paths.ts` owner — do **not** invent a route.
- **`live`/`served` on native `workboard.*` but `missing` on `cavi-control/kanban*`**
  → native is the real base path; the CAVI REST layer is divergent. Don't extend
  the divergent layer — extend/prefer the native base.
- **native drift** → reconcile the mirror in `providers/openclaw/workboard.ts`
  with native source; this package is a follower, not the contract owner.

## Then prove it

Diagnosis is read-only; it does not make a change "done". After any fix run the
`quality-gate` skill (`pnpm run verify`) and deliver via the `pr` skill. The
`health` workflow (`.claude/workflows/health.js`) runs diagnose + gate + a
repo/version/CI audit in parallel and synthesizes one report.

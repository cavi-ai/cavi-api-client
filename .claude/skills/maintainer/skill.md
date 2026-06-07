---
name: Maintainer
description: Use at the start of ANY change to @cavi-ai/api-client (this repo) — adding a provider, a feature, a fix, or docs. Establishes the safe-change protocol for a publicly consumed package: scope discipline, the boundary, the gate, and PR-only delivery.
---

# Maintaining @cavi-ai/api-client

This is a **published, publicly consumed package** with real downstream users
(mobile + portal clients, plus external installs). The prime directive: **a change
must never break a consumer.** Read `AGENTS.md` → "Operating Rules for AI Agents"
first — those rules are authoritative and override any instinct to just finish.

## The protocol for any change

1. **Scope it to one thing.** Only touch what the task requires. Spotted an
   unrelated problem? Note it for the human; do not fix it in this change. A PR
   does one thing.
2. **Know the layers.** Strict direction: `core → contracts → extensions/cavi →
   providers / frameworks`. Lower layers never import upward. Core stays
   **provider-agnostic** — no concrete provider name in a core interface, config
   key, or route. A new provider is an additive module under `src/providers/<x>/`
   implementing the universal `RuntimeClient` contract — a small module, not a
   fork. Mirror an existing provider (`providers/claude`, `providers/openclaw`).
3. **Respect the boundary.** Route literals live only in `*paths.ts` /
   `surfaces.ts` owner files. Filesystem code takes an explicit `repoRoot`. The
   public surface (`index.ts` + `package.json` subpath exports) is **additive-only**
   — never remove/rename/re-behave an export without a human-approved major.
4. **Never:** bump `version`, weaken a hardening/conformance test to pass, or push
   to `main`. These are non-negotiable (see `AGENTS.md`).
5. **Document what you touch.** Public-surface / route / behavior change ⇒
   `CHANGELOG.md` `[Unreleased]` entry + any affected `README.md` / `API.md` /
   `ARCHITECTURE.md`.
6. **Prove it.** Run the `quality-gate` skill — the change is done only when
   `pnpm run verify` is green.
7. **Deliver via PR.** Use the `pr` skill. Humans merge and publish; you don't.

## Reviewing someone else's change (especially another agent's)

If you're vetting work you didn't write — a contributor PR or another agent's
branch — use the `review-agent-change` skill. Default to suspicion: confirm the
diff matches the *stated* intent and nothing rode along with it.

## Reference

- `AGENTS.md` — the boundary contract + agent rules (authoritative).
- `CONTRIBUTING.md` — new-provider / new-feature checklists, dev setup.
- `CLAUDE.md` / `ARCHITECTURE.md` — architecture and layer map.
- `src/__tests__/package-hardening.test.ts` — the enforced boundary.

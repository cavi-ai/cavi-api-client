---
name: Review Agent Change
description: Use to vet a change you did NOT write before it lands in @cavi-ai/api-client — a contributor PR or (especially) another agent's branch/working tree. Audits for scope creep, boundary violations, undocumented surface changes, and security, then gives a keep/revert verdict. Default to suspicion.
---

# Reviewing an Agent's (or Contributor's) Change

Agents over-focus on their task and sprawl past it — bundling unrelated, risky,
undocumented edits under an innocent branch name. This package is publicly
consumed, so an unvetted change can break downstream users. **Default to
suspicion. Verify the diff matches the *stated* intent and nothing rode along.**

## Audit steps

1. **Establish the true scope vs `main`.** Don't trust the branch name or
   CHANGELOG — read the diff.
   ```sh
   git diff --stat main -- .       # tracked changes
   git status --short              # + untracked files
   ```
   List every changed path. Re-snapshot if the tree may still be moving (check
   file mtimes — an agent may still be writing).
2. **Compare scope to the stated intent.** Read `CHANGELOG`/PR/commit. **Every
   file changed must trace to the stated task.** Flag anything that doesn't
   (unrelated `extensions/`, `frameworks/`, `contracts/surfaces.ts`, other
   providers, `package.json` beyond the feature). That is the sprawl.
3. **Public surface & version.** Did exports / subpaths in `package.json` change?
   Did a `version` bump sneak in (agents must not bump)? Did an **exported
   resolver's behavior** change (e.g. a path base swap)? Behavior change =
   breaking, even with green tests.
4. **Guardrails not weakened.** Did it edit `package-hardening.test.ts` /
   conformance / `docs-integrity` to *match* new code rather than satisfy the
   contract? `git diff main -- src/__tests__/package-hardening.test.ts` and read
   every changed assertion. Weakening a guard to pass is a red flag.
5. **Boundary.** Route literals only in `*paths.ts`; core stays provider-agnostic
   (`grep -rIl "<providername>" src/core` → must be empty); layers respected.
6. **Security scan** (untrusted author):
   ```sh
   grep -rIoE "https?://[a-z0-9.-]+" src/providers/<x>/   # only expected hosts?
   grep -rInE "eval\(|child_process|exec|spawn|atob|btoa|fs\.|process\.env" src/providers/<x>/
   ```
   Confirm credentials flow only into the documented auth header — no exfil, shell,
   or filesystem access.
7. **Gate.** Run the `quality-gate` skill. Green is necessary, **not sufficient** —
   sprawl and behavior-breaks can be green.

## Verdict

Report per-file: **keep (matches intent) / revert (sprawl) / surgical (mixed —
keep the in-scope hunks, drop the rest)**. If unwanted work is bundled, recommend
isolating the intended change onto its own branch and reverting the rest — and
tell the human what to feed back to the author so it does not recur. Never merge;
the human decides.

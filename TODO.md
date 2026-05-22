# TODO

## Architecture Cleanup

- [x] Consolidate Discourse active implementation under `src/cavi/discourse/**`.
- [x] Consolidate Deb active implementation under `src/cavi/deb/**`.
- [x] Move generic data guards to `src/core/data/**`.
- [x] Move shared JSON HTTP request helpers and gateway HTTP errors to `src/core/http/**`.
- [x] Move gateway envelope/fallback contracts to `src/core/gateway/**`.
- [x] Move gateway health/log tail system loaders and shared TTL cache helpers to `src/core/gateway/**`.
- [x] Move generic runtime base-path helpers to `src/core/runtime/**`; keep CAVI runtime global wrappers in `src/cavi/runtime/**`.
- [x] Move Deb and operator route aliases to `src/cavi/paths.ts`; keep operator defaults/section helpers in `src/cavi/operator/**`.
- [x] Move gateway raw fetch helpers to `src/core/gateway/fetch.ts` and quarantine the CAVI runtime fetch duplicate.
- [x] Move generic SSE stream helpers to `src/core/sse/**`; keep gateway run-event translation/polling in `src/core/gateway/**`.
- [x] Move generic WebSocket target/close helpers to `src/core/ws/**` and quarantine the stale `src/core/gateway/websocket.ts` alias.
- [x] Wire CAVI gateway loader sessions and patch operations through the shared core session loader HTTP fallback.
- [x] Quarantine duplicate Deb/Discourse mock fixtures and stale generated `dist` outputs.
- [x] Quarantine remaining `src/cavi/data/cavi-control/**` files instead of keeping a path-only active folder.
- [x] Quarantine `src/cavi/data/lib/**` compatibility re-export shims and enforce that folder stays out of active source.
- [x] Quarantine the last `src/cavi/data/cavi-control/api-paths.ts` holder and import cost/scoring paths from `src/contracts/paths.ts`.
- [x] Quarantine `src/compat/martina/**` public compatibility exports and remove them from package exports/build include.
- [x] Move dynamic portal route construction to `src/contracts/paths.ts` and quarantine CAVI runtime HTTP transport / portal client-id core re-export shims.
- [x] Move portal envelope/library/memory contracts to `src/contracts/portals.ts` and quarantine the old CAVI portal contract owner.
- [ ] Review large `src/cavi/fallbacks/snapshots/operator/**` fallback modules for feature-owned boundaries.
- [ ] Review `src/cavi/adapters/cavi-control-adapters/gateway-ws-snapshot-loaders.ts`; keep CAVI fallbacks/adapters there, but move any reusable gateway snapshot orchestration to core with injected fallbacks.
- [x] Keep hardening checks preventing `src/cavi/data/**`, hidden CAVI feature path owners, CAVI runtime gateway fetch/core transport shims, portal client-id/contract shims, gateway-owned generic SSE helpers, and gateway-owned WebSocket alias files from returning to active source.
- [ ] Run `npm run build` and `npm test` before any commit, publish, or linked consumer verification.

## Working Rules

- Move stale code into quarantine instead of deleting it.
- Keep route literals in path-owner files.
- Prefer gateway-agnostic interfaces first; provider-specific behavior belongs behind provider modules.
- Keep consumer registry/team edits in consumer-owned manifest code.

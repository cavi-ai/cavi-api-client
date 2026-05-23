# Gateway Core

This folder owns provider-neutral gateway contracts and shared runtime behavior.
Provider-specific compatibility belongs in `src/providers/**`; product-specific
composition belongs in `src/cavi/**`.

## Folder Map

- `client/` owns HTTP-facing gateway client helpers.
- `agent/` owns agent capabilities, config, and voice config.
- `run/` owns run contracts, run-event streams, SSE, and stream failures.
- `rpc/` owns WebSocket RPC, device auth, and preauth handshakes.
- `snapshots/` owns session/system loaders, snapshot loaders, and snapshot
  transforms.
- `resources/` owns gateway resource clients such as media and wiki.
- `envelope/` owns data envelopes, fallback gaps, and mutation result helpers.
- `portal/` will own portal-specific gateway bridge helpers.

The flat files in this folder are compatibility barrels while the codebase moves
toward the folder map above. New implementation should prefer the canonical
folder owner when one exists.

## Rules

- Do not import from `src/providers/**`, `src/cavi/**`, or `src/react/**`.
- Do not add provider names, provider cookies, provider filesystem paths, or
  provider WebUI compatibility here.
- Do not add API route literals outside `src/contracts/paths.ts` or
  `src/contracts/surfaces.ts`.
- Keep public exports stable through `src/core/gateway/index.ts` and root
  package exports.

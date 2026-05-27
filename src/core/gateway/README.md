# Gateway Core

This folder owns provider-neutral gateway contracts and shared runtime behavior.
Provider-specific implementations belong in `src/providers/**`; product-specific
composition belongs in `src/extensions/cavi/**`.

## Folder Map

- `client/` owns HTTP-facing gateway client helpers.
- `agent/` owns agent capabilities, config, and voice config.
- `run/` owns run contracts, run-event streams, SSE, and stream failures.
- `rpc/` owns WebSocket RPC, device auth, and preauth handshakes.
- `snapshots/` owns session/system loaders, snapshot loaders, TTL cache helpers,
  and snapshot transforms.
- `resources/` owns gateway resource clients such as media and wiki.
- `envelope/` owns data envelopes, fallback gaps, and mutation result helpers.
- `portal/` owns portal-specific gateway bridge helpers.
- `providers/` owns the provider plugin interface, registry, normalization, and
  generic factory dispatch. It must not import concrete provider implementations.

Gateway implementation lives in folder-owned modules. New implementation and
package-owned imports must use a canonical folder owner or the single
`index.ts` aggregate.

## Rules

- Do not import concrete `src/providers/**`, `src/extensions/cavi/**`, or `src/frameworks/**`.
- Do not add provider names, provider cookies, provider filesystem paths, or
  provider-specific WebUI behavior here.
- Do not add API route literals outside `src/contracts/paths.ts` or
  `src/contracts/surfaces.ts`.
- Keep public exports stable through the root package export, supported package
  subpaths, and this folder's single canonical `index.ts`.
- Do not add root flat shim files or provider-resolution modules in this folder.

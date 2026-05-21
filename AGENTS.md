# @cavi/api-client

This package is the single private API client package for mobile and portal clients.

## Source Of Truth

- Import this package as `@cavi/api-client`.
- Do not import or reintroduce `@cavi/data`, `@cavi/domain`, `@cavi/gateway-client`, `@cavi/gateway-transforms`, or `@mobile-cavi/*`.
- Compatibility aliases may exist inside this package only when needed to avoid breaking existing app imports. New public APIs should use gateway-agnostic names first.

## Gateway Model

- Keep one client interface with provider-specific override implementations behind it.
- Core APIs must be gateway-agnostic. Do not hardcode a product gateway such as Hermes or OpenClaw into new core interfaces, config keys, or routing decisions.
- Provider-specific names are acceptable only in compatibility exports or provider-specific modules.

## Paths

- API path literals belong in files whose name ends with `paths.ts`, especially `src/paths.ts`.
- Do not scatter route strings through clients, React adapters, or mobile-specific code.
- `src/endpoints.ts` is a compatibility re-export only; do not add route literals there.

## Repo Roots

- Filesystem integrations must receive an explicit `repoRoot` or resolve `REPO_ROOT` through `src/repo-root.ts`.
- Do not reach out to a host repo using relative imports like `../../registry/...`.
- Mobile apps choose their repo root at runtime; this package must not assume Hermes, OpenClaw, or any specific checkout layout.

## Tests

- Run `npm test` for package guardrails and API behavior.
- Run `npm run build` before publishing or linking a changed package.
- Hardening tests are contract tests. Update them only when the package boundary intentionally changes.

# Postman — gateway surface verification

Importable Postman collection and environment for proving that every **gateway /
CAVI surface contract** this package declares exists on a live backend.

| File | Role |
| --- | --- |
| `cavi-api-client.postman_collection.json` | Requests + tests (generated) |
| `cavi-api-client.postman_environment.json` | Host, secrets, path params (generated defaults; edit locally) |

Both JSON files are **generated** by [`scripts/postman/generate.mjs`](../../scripts/postman/generate.mjs)
from `SURFACE_CONTRACTS` + `CAVI_SURFACE_CONTRACTS`. Do not hand-edit them.

```bash
pnpm run build
pnpm run postman:generate
```

`pnpm run postman:check` fails if either file drifts from the contracts.

## Setup (Postman app)

1. **Import** both files from this folder.
2. Select environment **cavi-api-client — local gateway**.
3. Set:
   - `baseUrl` — gateway origin only (example default `http://localhost:18789`)
   - `token` — bearer credential (**secret**; never commit a real value)
4. Override path params as needed (`example-team`, `example-portal`, … are placeholders).
5. **Run collection**.

Environment values override collection defaults. Keep host-specific ids and
tokens on the environment only.

## Variables (first-class)

| Variable | Scope | Notes |
| --- | --- | --- |
| `baseUrl` | Environment | Origin, no trailing slash |
| `token` | Environment (secret) | Bearer auth for the whole collection |
| `teamId`, `agentId`, `portal`, … | Environment (override) | Agnostic samples in git; substitute real ids locally |

Every path parameter used by a surface contract is declared as a collection
variable **and** an environment value, with a short description in Postman.

## What a run proves

| Contract `degradation` | Request test | Meaning |
| --- | --- | --- |
| `hard` | Fails on `404` / `5xx` | Endpoint must exist |
| `gap` | Never fails; reports `PROVEN (2xx)` vs `unproven` | May be missing; run records reality |

## CLI (Newman)

```bash
npx newman run docs/postman/cavi-api-client.postman_collection.json \
  -e docs/postman/cavi-api-client.postman_environment.json \
  --env-var token="$GATEWAY_TOKEN" \
  --env-var baseUrl="https://gateway.example"
```

## Privacy / agnostic defaults

Defaults are placeholders (`example-team`, `example-portal`, …). They must not
encode private fleet names, personal names, or production hosts. The generator
rejects a known denylist of fleet/personal tokens.

## Scope

Covers gateway + CAVI **surface contracts** on one host with bearer auth.

**Not included:** Anthropic / OpenAI / Google runtime HTTP APIs (separate hosts
and auth). Those are covered by `src/__tests__/providers/**`.

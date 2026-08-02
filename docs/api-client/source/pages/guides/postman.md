---
documentedVersion: 0.15.0
---

# Verify gateway surfaces with Postman

Use the generated Postman collection to prove that every **gateway / CAVI surface
contract** this package declares exists on a live backend.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

## Files

In the package repository (and convenience copies under `docs/postman/`):

| File | Purpose |
| --- | --- |
| `cavi-api-client.postman_collection.json` | One request per surface contract + hard/gap tests |
| `cavi-api-client.postman_environment.json` | `baseUrl`, secret `token`, agnostic path-param defaults |

Regenerate after contract changes:

```bash
pnpm run build
pnpm run postman:generate
```

## Setup

1. Import both JSON files into Postman.
2. Select environment **cavi-api-client — local gateway**.
3. Set `baseUrl` (gateway origin, no trailing slash) and `token` (bearer secret).
4. Replace example path params (`example-team`, `example-portal`, …) with ids your gateway knows.
5. Run the collection.

Environment values override collection defaults. Never commit a real token.

## What the run means

| Contract degradation | Test behavior |
| --- | --- |
| `hard` | Fails on HTTP 404 or 5xx — the endpoint must exist |
| `gap` | Never fails; reports `PROVEN (2xx)` vs `unproven` |

## CLI

```bash
npx newman run docs/postman/cavi-api-client.postman_collection.json \
  -e docs/postman/cavi-api-client.postman_environment.json \
  --env-var token="$GATEWAY_TOKEN" \
  --env-var baseUrl="https://gateway.example"
```

## Scope

Gateway + CAVI surfaces on one host with bearer auth. Claude / Codex / Gemini /
other provider HTTP APIs are out of scope here — use provider conformance tests.

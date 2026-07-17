# Postman collection — surface verification

`cavi-api-client.postman_collection.json` is **generated** from this package's
own surface contracts (`SURFACE_CONTRACTS` + `CAVI_SURFACE_CONTRACTS`) by
[`scripts/postman/generate.mjs`](../../scripts/postman/generate.mjs). It exists
to answer one question against a live backend: **does every endpoint this
package declares actually exist?**

Do not hand-edit the collection. Change the contracts and regenerate:

```bash
pnpm run build          # the generator reads the compiled dist/ surfaces
pnpm run postman:generate
```

`postman:check` (run in CI, not in `pnpm test`) fails if the committed
collection has drifted from the contracts.

## What a run proves

Every request carries a test derived from the contract's `degradation`:

| degradation | request test | meaning |
| ----------- | ------------ | ------- |
| `hard` | fails on `404` or `5xx` | the endpoint MUST exist; a failure is a real contract break |
| `gap` | never fails; reports `PROVEN (2xx)` vs `unproven (Nxx)` | the endpoint may not be served yet — the run records which are real |

16 of 17 CAVI surfaces are `gap` today. A green `hard` run plus a
`PROVEN`/`unproven` tally for the `gap` surfaces is exactly the evidence needed
to promote a surface from `gap` to `hard` (or to delete an unproven one).

## Running it

**Postman app:** import both files, select the environment, set `token`, Run
Collection.

**CLI (no repo dependency added):**

```bash
npx newman run docs/postman/cavi-api-client.postman_collection.json \
  -e docs/postman/cavi-api-client.postman_environment.json \
  --env-var token="$GATEWAY_TOKEN" \
  --env-var baseUrl="https://your-gateway.example"
```

## Scope

The collection covers the 50 gateway/CAVI **surface contracts** — one host,
bearer auth. Provider runtime APIs (Anthropic / OpenAI / Google) are external
services with their own hosts, auth, and request bodies; they are exercised by
the provider conformance tests in `src/__tests__/providers/**`, not here.

---
documentedVersion: 0.12.0
---

# Gemini (Google) operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Runtime-only provider over the Gemini Developer API
(`generativelanguage.googleapis.com`). Auth: `x-goog-api-key`. The model is
part of the URL path, not the body, and an explicit model is **required** — no
default ships (`GEMINI_API_VERSION` is `v1beta`). `generateContent` is
synchronous request/response, so `getRun`/`cancelRun` throw
`EndpointNotFound`. The batch surface is supported over
`batchGenerateContent`.

Capability (`GEMINI_RUNTIME_SUPPORT`): runs ✅ · getRun ❌ · cancelRun ❌ ·
streamRun ✅ · batch ✅.

> **Path notation.** Gemini route helpers build paths as
> `/${GEMINI_API_VERSION}/${resource}` — the version prefix is a constant and
> the model/batch resource is interpolated. The `**HTTP**` lines below write
> that resource as a leading path variable (`:model` = `models/<id>`,
> `:batch` = `batches/<id>`) after the `/v1beta` prefix; the only static path
> literal in `gemini/paths.ts` is the files-upload path.

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `POST /v1beta/:model:generateContent`
**Capability** `supports.runs`

Requires `model`; maps the universal body to a Gemini `generateContent`
request and normalizes `output`/`tokens` from the response. See
[runtime · startRun](../runtime.md#startrun) for the full field tables.

### Example

```ts
import { createGeminiProviderModule } from "@cavi-ai/api-client/providers/gemini";
// … construct the runtime client (explicit model required), then:
const run = await client.startRun({ input: "Hi", model: "gemini-2.5-pro" });
```

## streamRun

**Signature** `client.streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers): Promise<void>`
**HTTP** `POST /v1beta/:model:streamGenerateContent` (SSE, `?alt=sse`)
**Capability** `supports.streaming`

Streams `streamGenerateContent` SSE chunks, normalized to canonical run-stream
events. See [runtime · streamRun](../runtime.md#streamrun).

## getRun / cancelRun

**HTTP** `n/a` (throws `EndpointNotFound`)
**Capability** unsupported

`generateContent` is synchronous, so there is no run handle to poll or cancel;
both methods throw an `EndpointNotFound`-class error.

## submitBatch / getBatch / cancelBatch / getBatchResults

**HTTP** `POST /v1beta/:model:batchGenerateContent` · `GET /v1beta/:batch` ·
`POST /v1beta/:batch:cancel`
**Capability** `supports.batch`

`submitBatch` posts to `batchGenerateContent`; `getBatch`/`cancelBatch` act on
the returned batch resource name; `getBatchResults` reads the batch and returns
inline or file-backed results (throwing `EndpointNotFound` while results are not
yet available — poll `getBatch` first). Field tables per
[runtime · batch operations](../runtime.md#submitbatch).

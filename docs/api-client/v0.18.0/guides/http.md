---
documentedVersion: 0.18.0
---

# Integrate an HTTP service

Use `createApiClient` for agent workflows. Choose
`@cavi-ai/api-client/core/http` when integrating an HTTP service directly or
implementing an adapter that owns request and response handling. These clients
provide credentials, request deadlines, cancellation, and typed exceptions;
they do not create runtime capabilities or validate your service's data schema.

## Choose who owns the response

| Need | Choose | Your responsibility |
| --- | --- | --- |
| Decode a finite JSON response | `JsonHttpApiClient.request<unknown>` | Validate the decoded value before using it |
| Consume a finite non-JSON response | `RawHttpApiClient.consumeResponse` when exported | Await the body read inside the callback |
| Own a raw response or long-lived stream | `RawHttpApiClient.raw` | Consume or cancel the body and bound its lifetime |
| Call an existing provider operation | Its provider client or the runtime facade | Handle its documented result and capability contract |

The versioned reference describes published `0.18.0`. Response
ownership, cancellation, header precedence, Fetch controls, HEAD/OPTIONS,
streamed uploads, and query composition have changed across releases. Check the
[release changelog](https://github.com/cavi-ai/cavi-api-client/blob/main/CHANGELOG.md)
before relying on these guarantees with an older package. `consumeResponse`
requires a release whose export declarations include that method.

## Bound a complete read

Configure a `baseUrl`, credentials, and a `defaultTimeoutMs` appropriate for your
service. Pass the application's `AbortSignal` to each request. HTTP JSON, blob,
file, and batch-result reads keep both the request deadline and caller signal
active through body consumption, including a stalled body after successful
headers. A request deadline is not an end-to-end runtime execution deadline.

For finite text or binary responses, use `consumeResponse(path, init, consume)`
and await `response.text()`, `response.arrayBuffer()`, or your own body parser
inside its asynchronous callback. Returning the `Response` or starting a
detached read transfers the work outside that lifetime. HTTP subclasses can
use the protected `requestWithResponse` method for the same ownership model.

`raw()` and `requestGatewayRaw` transfer body ownership when the response is
returned. Their request deadline does not bound subsequent body reads. A caller
that takes ownership must supply its own read deadline and consume or cancel
the body, including on handler failure. Use the [streaming guide](streaming.md)
for runtime streams rather than treating SSE as a finite response.

Gateway JSON, blob, and form-data helpers and CAVI library JSON reads retain
their signal and deadline through consumption. Managed Agents deletion and
gateway acknowledgement helpers cancel unread successful bodies on a best
effort basis; disposal failures do not replace a successful acknowledgement.
Hermes chat starts retain their lifetime through parsing, and chat streams
dispose subscriptions and abort listeners when they settle. Claude, Codex, and
AGY stream calls also remove caller abort listeners on settlement.

## Handle typed errors and cancellation

Check caller cancellation **before** classifying HTTP errors:
`signal.aborted && error === signal.reason`. The original reason is preserved,
including strings, numbers, booleans, null, and caller-created `HttpApiError`
instances. Replacing it with a new exception loses caller intent. A late abort
does not replace a failure or timeout that already occurred.

For `JsonHttpApiClient`, branch on `isGatewayHttpError` for a non-success server
response; inspect `status` and the backend `code`. Branch on `isHttpApiError`
for malformed successful JSON, network failures, and request timeouts.
Classification uses the error instance, never message or request-path text.
These errors inherit `ApiClientError`; the root `isApiClientError` guard also
recognizes them. Other provider and Fetch helpers retain their documented
exception contracts; do not assume every client uses the JSON client's mapping.

Malformed JSON diagnostics include status, content type, and a redacted preview;
they omit engine parser messages that can contain credentials. The
`HttpApiError.body` property retains the original payload. Keep it in protected
diagnostics and apply your application's redaction policy before recording or
displaying it. See [application error handling](errors.md) for safe caller messages.

There is no universal automatic retry policy. A timeout or network failure can
leave a submitted write running upstream. Reconcile a known run or resource
before resubmitting; a status code or idempotency header alone does not establish
that the backend can safely replay the operation.

## Configure the request deliberately

Header names are case-insensitive. Request `headers` override `defaultHeaders`;
configured bearer or credential-resolver headers take precedence over both.
An explicit `idempotencyKey` overrides a same-named header. JSON requests add
`Content-Type: application/json` only when no content type was supplied. Keep
credentials in server-owned configuration rather than accepting them from callers.

`toHttpRequestInit` preserves Fetch headers supplied as a record, tuple list, or
`Headers` instance. Its second argument replaces those headers, even when it is
an empty record. It trims and uppercases supported methods, including HEAD and
OPTIONS. Gateway JSON/form-data helpers recognize `application/json`
case-insensitively, including `Application/JSON; charset=utf-8`.

`redirect`, `integrity`, `keepalive`, `mode`, `priority`, `referrer`, and
`referrerPolicy` flow through HTTP requests and gateway Fetch helpers. Explicit
false and empty-string values are retained; omitted settings use platform
defaults. Use `redirect: "error"` to reject redirects or `"manual"` to prevent
following them; existing non-success response handling still applies to manual
redirect responses. Fetch enforces integrity, CORS, referrer policy, and other
platform restrictions.

For an upload stream, pass a `ReadableStream` as `rawBody` or Fetch's `body`.
The transport supplies `duplex: "half"` for native Node Fetch without buffering
the stream. Other body types are unaffected; browser support and restrictions
still apply. Supply a suitable content type for your service.

Use `withQuery` to append parameters before a URL fragment while preserving
existing query encoding and repeated parameters. For example,
`withQuery("/items?mode=fast#details", { limit: 2 })` produces
`/items?mode=fast&limit=2#details`. Undefined values are omitted; an empty addition
leaves the original path unchanged.

For Hermes chat or its gateway alias, set tenant/routing headers once on the
streaming call. Both the run-start request and event stream receive them.

## Run the HTTP consumer example

Download
[http-workflow.ts](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/examples/development/http-workflow.ts)
and
[http-tests.ts](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/examples/development/http-tests.ts)
into `examples/` in an ESM Node project. These examples require a package
that exports `RawHttpApiClient.consumeResponse`. To check a locally built
candidate, install its tarball and development tools:

```sh
npm install /absolute/path/to/cavi-ai-api-client-candidate.tgz
npm install --save-dev typescript @types/node
npx tsc --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --strict --skipLibCheck --types node --outDir .consumer-tests \
  examples/http-tests.ts examples/http-workflow.ts
node --test .consumer-tests/http-tests.js
```

The reader returns data and propagates original exceptions. Its failure mapper
uses the package's error guards and preserves cancellation priority. It performs
no retries or console logging. Six tests use real loopback HTTP and native Fetch
to check credentials/query composition, typed errors, body deadlines, original
cancellation reasons, HEAD, and streamed uploads. Fixtures use no provider
credentials and close their servers through test cleanup hooks.

# Resume a background run for its authorized owner

This is application example code using **unreleased** `waitForRun`. It is
available in development builds, not the pinned npm release. See the
[run result guide](run-results.md) and [Unreleased changelog](../../CHANGELOG.md#unreleased).

A worker or request handler should resume known work through retrieval rather
than submit the same input again. Before retrieval or cancellation, authorize
the authenticated actor against the application's stored run record and the
selected provider/credential scope. Knowing a provider run ID grants no access.

## Bind the client to application authorization

Download [owned-background-runs.ts](../../examples/owned-background-runs.ts).
The callback answers your application's permission policy for an actor, run,
and action. Read permission does not imply cancellation permission. Denial
uses the package's typed error with a controlled message; lookup exceptions
propagate and no provider request is issued when authorization fails.

```ts
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType, waitForRun, type CapabilityClient, type CapabilityResult, type RunWaitOptions, type RunWaitResult } from "@cavi-ai/api-client";

// Application policy backed by stored ownership and permissions in this client's scope.
export type CanAccessRun = (
  actorId: string,
  runId: string,
  action: "read" | "cancel",
) => Promise<boolean>;

export function createOwnedRunService(client: CapabilityClient, canAccess: CanAccessRun) {
  async function assertAccess(actorId: string, runId: string, action: "read" | "cancel") {
    if (await canAccess(actorId, runId, action) !== true) {
      throw new ApiClientError("Run access denied.", {
        type: ApiClientErrorType.Auth, code: ApiClientErrorCode.PermissionDenied,
      });
    }
  }

  async function get(actorId: string, runId: string) {
    await assertAccess(actorId, runId, "read");
    return client.getRun(runId);
  }

  return {
    get,
    async wait(
      actorId: string,
      runId: string,
      options: RunWaitOptions,
    ): Promise<CapabilityResult<RunWaitResult>> {
      const initial = await get(actorId, runId);
      if (!initial.ok) return initial;
      const data = await waitForRun({ getRun: (id) => get(actorId, id) }, initial.data, options);
      return { ok: true, source: initial.source, data };
    },
    async cancel(actorId: string, runId: string) {
      await assertAccess(actorId, runId, "cancel");
      return client.cancelRun(runId);
    },
  };
}
```

Create this service once for a configured `CapabilityClient` and a matching
authorization lookup. Obtain `actorId` from your trusted authentication
context, never from a body field or an unverified header. The lookup should
match the tenant/actor, stored run ID, provider configuration, and allowed
action. Return `false` for missing records and unauthorized actors alike.
Keep the ownership store and credentials on the trusted backend.

Call `service.get(actorId, runId)` for a single snapshot, or
`service.wait(actorId, runId, { maxPolls: 10, pollIntervalMs: 1_000,
maxWaitMs: 30_000, signal: request.signal })` for a local polling wait. Supply
the budgets from application policy. Every poll repeats the read authorization
check, so revoked access rejects before the next provider retrieval.

The service borrows the client and never disposes or submits work. Its owner
disposes the client at shutdown. Use server-side retrieval providers for
cross-worker resume; client-remembered synchronous run IDs do not survive
client/process replacement.

## Interpret retrieval and waiting separately

`wait` first performs an authorized `getRun`. An initial facade gap is returned
unchanged as `ok: false`. After a live snapshot, `ok: true` carries a
`RunWaitResult`; it means the initial retrieval succeeded, not that execution
completed. `source` is the initial retrieval's source.

| Result | Application action |
| --- | --- |
| Initial `ok: false` | Inspect the retrieval gap; do not resubmit work |
| `data.reason: terminal` | Inspect `data.run.status`; use `requireRunText` only if a completed answer is required |
| `data.reason: gap` | Retain the last observed run and inspect the polling gap |
| `data.reason: timeout`, `poll-limit`, or `aborted` | Retain the run ID and snapshot for a later authorized resume |
| `data.reason: state-not-pollable` | Reconcile unknown or other unpollable state deliberately |
| Exception | Handle local permission denial, provider authentication, or the original unclassified failure |

The time and poll budgets apply **after** the initial authorized retrieval.
That retrieval and authorization-store calls need their own timeouts. Caller
abort ends the polling wait; it does not abort `getRun` HTTP requests or
cancel backend work. Poll counts exclude the initial retrieval. Keep HTTP
timeouts configured separately; late pending retrieval settlements are ignored
by `waitForRun`.

## Cancel only through an explicit action

Call `service.cancel(actorId, runId)` from your authenticated cancellation
action. It checks cancellation permission immediately before calling
`cancelRun`. A stopped local wait never calls it. Inspect the cancellation
result, then retrieve state if your application requires confirmation; a
request timeout or a submitted cancellation request alone does not prove
backend termination.

Store a successful start's run ID with its owner and provider scope before
exposing it to workers or callers. If submission or persistence is ambiguous,
reconcile known work rather than replay the input automatically. This example
does not implement submission, durable ownership storage, or a retry policy.

Map permission denial to your application's controlled response. Keep provider
errors, gaps, `errorDetails`, and snapshots in protected diagnostics; return
only application-approved state, text, and usage to the frontend. Do not send
the service's raw result directly as an HTTP response.

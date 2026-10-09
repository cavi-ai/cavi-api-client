---
documentedVersion: 0.18.0
---

# Own provider file IDs and their cleanup

There is no provider-neutral files API in this release. File IDs, uploads,
retention, and prompt references belong to the provider. Never reuse a file ID
from one backend on another.

Use the narrow Codex file entry on your server. Configure a reusable
`CodexFilesClient` with your server-owned API key and request timeout, then pass
it to these helpers. They upload prepared OpenAI batch JSONL and remove a saved
file ID in a later worker, without relying on an in-memory cleanup callback.

Download [batch-files.ts](../examples/batch-files.ts). Both helpers borrow the
file client; they do not create or dispose a runtime client.

```ts
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "@cavi-ai/api-client";
import type { CodexFilesClient } from "@cavi-ai/api-client/providers/codex/files";

export async function uploadBatchInput(files: CodexFilesClient, jsonl: string) {
  if (!jsonl.trim()) throw new ApiClientError("Batch input is required.", {
    type: ApiClientErrorType.Validation, code: ApiClientErrorCode.InvalidRequest,
  });
  const file = await files.uploadFile(jsonl, "batch", "input.jsonl");
  if (typeof file?.id !== "string" || !file.id.trim()) {
    throw new ApiClientError("Upload returned no usable file ID.", {
      code: ApiClientErrorCode.ProtocolMismatch, cause: file,
    });
  }
  return file;
}

export async function removeBatchInput(files: CodexFilesClient, fileId: string) {
  if (!fileId.trim()) throw new ApiClientError("A saved file ID is required.", {
    type: ApiClientErrorType.Validation, code: ApiClientErrorCode.InvalidRequest,
  });
  const receipt = await files.deleteFile(fileId);
  if (receipt?.id !== fileId || receipt?.deleted !== true) {
    throw new ApiClientError("Deletion was not confirmed for the saved file.", {
      code: ApiClientErrorCode.ProtocolMismatch, cause: { fileId, receipt },
    });
  }
  return { id: fileId, deleted: true as const };
}
```

The JSONL must follow the provider's batch wire format; a serialized
`RuntimeBatchRequest[]` is not that format. Prefer the facade's
[batch submission](batching.md) for its built-in request conversion.

Retain the ID with the owning job. Delete only after the provider no longer
needs the file and your retention policy allows it. Disposing a runtime client
does not delete uploaded files.

## Keep cleanup explicit and durable

| Step | Application responsibility |
| --- | --- |
| Upload | Save the returned file ID and metadata with the job, provider, credential scope, and application owner |
| Use | Keep the file while the provider still needs it; runtime client shutdown is separate |
| Authorize cleanup | Load the saved record and check ownership and retention before passing its ID to `removeBatchInput` |
| Delete | Mark cleanup confirmed only after the helper returns its receipt |
| Cleanup failure | Retain the ID and failure state for reconciliation; do not mark it deleted |

The deletion helper requires `deleted: true` for the same saved ID. An absent,
false, or mismatched acknowledgment raises `ApiClientError` with
`ProtocolMismatch`, retaining the file ID and receipt in `cause`. Blank input
or IDs raise `InvalidRequest` before a provider request. These are application
checks; the underlying SDK file methods remain unchanged.

File methods are provider-specific raw APIs. HTTP, authentication, and unknown
failures reject rather than returning facade gaps. Keep original diagnostics
in protected telemetry and show application-owned messages to callers. A 404
does not satisfy this helper's confirmation policy; decide separately how your
job system reconciles a file that is already absent.

Do not delete in an unconditional `finally` immediately after uploading input
for an asynchronous batch. The remote job can outlive that request. If an
upload response is lost or has no usable ID, do not replay it automatically:
an uploaded file may already exist and require provider-side reconciliation.
Failure to persist an acknowledged ID also needs reconciliation.

## Run the file lifecycle tests

Download [file-tests.ts](../examples/file-tests.ts) beside the helpers in
`examples/`. Use the ESM workspace and installation from
[consumer testing](testing.md), then run:

```sh
npx tsc --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --strict --skipLibCheck --types node --outDir .file-tests \
  examples/file-tests.ts examples/batch-files.ts
node --test .file-tests/file-tests.js
```

Expected result: seven passing tests without real credentials or network calls.
HTTP fixtures exercise the installed public file client, multipart input,
metadata retention, cleanup from a saved ID, invalid acknowledgments, and
authentication/availability failures. The file client has no owned socket to
close; each fixture creates an isolated client and finite HTTP responses.

[Codex file methods](../reference/providers-codex-files.md) ·
[Gateway workspace access](gateway.md)

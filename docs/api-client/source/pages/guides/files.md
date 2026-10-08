---
documentedVersion: {{documentedVersion}}
---

# Own provider file IDs and their cleanup

There is no provider-neutral files API in this release. File IDs, uploads,
retention, and prompt references belong to the provider. Never reuse a file ID
from one backend on another.

Use the narrow Codex or Gemini file entry on your server. This Codex example
uploads already prepared OpenAI batch JSONL and returns an explicit cleanup
function to the caller:

```ts
import { CodexFilesClient } from "@cavi-ai/api-client/providers/codex/files";

export async function uploadBatchInput(apiKey: string, jsonl: string) {
  const files = new CodexFilesClient({ apiKey, defaultTimeoutMs: 30_000 });
  const file = await files.uploadFile(jsonl, "batch", "input.jsonl");
  return { id: file.id, remove: () => files.deleteFile(file.id) };
}
```

The JSONL must follow the provider's batch wire format; a serialized
`RuntimeBatchRequest[]` is not that format. Prefer the facade's
[batch submission](batching.md) for its built-in request conversion.

Retain the ID with the owning job. Delete only after the provider no longer
needs the file and your retention policy allows it. Disposing a runtime client
does not delete uploaded files.

Gemini's [file client](../reference/providers-gemini-files.md) has a different
upload contract. Resumable uploads stay on the configured API origin, reject
redirects, and honor cancellation/timeout options. Failures use a status-only
`ApiClientError`; its cause does not retain raw response bodies.

[Codex file methods](../reference/providers-codex-files.md) ·
[Gateway workspace access](gateway.md)

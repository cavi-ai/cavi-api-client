import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiClientError, isAuthError } from "@cavi-ai/api-client";
import { CodexFilesClient } from "@cavi-ai/api-client/providers/codex/files";
import { uploadBatchInput, removeBatchInput } from "./batch-files.js";

function fixture(reply: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const files = new CodexFilesClient({ apiKey: "fixture-key", defaultTimeoutMs: 1_000,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return reply(String(url), init);
    },
  });
  return { files, calls };
}

test("uploads provider JSONL as multipart and retains file metadata without deleting", async () => {
  const app = fixture(() => Response.json({ id: "file-1", object: "file", bytes: 12 }));
  const jsonl = '{"custom_id":"one","method":"POST","url":"/v1/responses","body":{"model":"server-model","input":"Question"}}';
  const file = await uploadBatchInput(app.files, jsonl);
  assert.deepEqual(file, { id: "file-1", object: "file", bytes: 12 });
  assert.equal(app.calls.length, 1);
  const { url, init } = app.calls[0];
  assert.equal(url, "https://api.openai.com/v1/files");
  assert.equal(init?.method, "POST");
  assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-key");
  assert.ok(init?.body instanceof FormData);
  assert.equal(init.body.get("purpose"), "batch");
  const content = init.body.get("file");
  assert.ok(content instanceof File);
  assert.equal(content.name, "input.jsonl");
  assert.equal(await content.text(), jsonl);
});

test("cleans up a persisted ID through a newly configured worker client", async () => {
  const app = fixture(() => Response.json({ id: "file-1", deleted: true }));
  const receipt = await removeBatchInput(app.files, "file-1");
  assert.deepEqual(receipt, { id: "file-1", deleted: true });
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].url, "https://api.openai.com/v1/files/file-1");
  assert.equal(app.calls[0].init?.method, "DELETE");
});

test("rejects blank input or IDs before provider work", async () => {
  const app = fixture(() => { throw new Error("Invalid input reached the provider"); });
  for (const value of ["", " ", "\n"]) {
    await assert.rejects(uploadBatchInput(app.files, value), { code: "invalid_request" });
    await assert.rejects(removeBatchInput(app.files, value), { code: "invalid_request" });
  }
  assert.equal(app.calls.length, 0);
});

test("rejects upload responses without a usable file ID", async () => {
  for (const reply of [null, {}, { id: "" }, { id: " " }]) {
    const app = fixture(() => Response.json(reply));
    await assert.rejects(uploadBatchInput(app.files, "{}"), { code: "protocol_mismatch" });
    assert.equal(app.calls.length, 1, "an ambiguous upload must not be replayed or deleted automatically");
  }
});

test("requires deletion confirmation for the same saved ID", async () => {
  for (const reply of [null, { id: "file-1", deleted: false }, { id: "foreign", deleted: true }, { deleted: true }]) {
    const app = fixture(() => Response.json(reply));
    await assert.rejects(removeBatchInput(app.files, "file-1"), (error) => {
      assert.ok(isApiClientError(error));
      assert.equal(error.code, "protocol_mismatch");
      assert.equal((error.cause as { fileId: string }).fileId, "file-1");
      return true;
    });
    assert.equal(app.calls.length, 1);
  }
});

test("retains failed cleanup as an exception rather than reporting deletion", async () => {
  const app = fixture(() => Response.json({}, { status: 503 }));
  await assert.rejects(removeBatchInput(app.files, "file-1"), isApiClientError);
  assert.equal(app.calls.length, 1);
});

test("keeps authentication failures as exceptions", async () => {
  const app = fixture(() => Response.json({}, { status: 401 }));
  await assert.rejects(uploadBatchInput(app.files, "{}"), isAuthError);
  assert.equal(app.calls.length, 1);
});

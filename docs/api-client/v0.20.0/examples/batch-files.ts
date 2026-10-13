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

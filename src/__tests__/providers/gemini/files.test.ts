import { describe, expect, it, vi } from "vitest";
import { ApiClientErrorCode } from "../../../core/errors";
import { GeminiFilesClient } from "../../../providers/gemini/files";

type FetchCall = { url: string; init?: RequestInit };

function uploadFetch(uploadUrl: string): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) {
      return new Response("", {
        status: 200,
        headers: { "x-goog-upload-url": uploadUrl },
      });
    }
    return new Response(JSON.stringify({ file: { name: "files/input" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch & { calls: FetchCall[] };
  fetchImpl.calls = calls;
  return fetchImpl;
}

describe("GeminiFilesClient", () => {
  it("rejects a resumable upload destination on another origin before sending credentials or bytes", async () => {
    const fetchImpl = uploadFetch("https://uploads.attacker.test/session");
    const client = new GeminiFilesClient({ apiKey: "secret-key", fetchImpl });

    await expect(client.uploadFile("payload")).rejects.toMatchObject({
      code: ApiClientErrorCode.RequestFailed,
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("preserves same-origin resumable uploads", async () => {
    const fetchImpl = uploadFetch(
      "https://generativelanguage.googleapis.com/upload/session",
    );
    const client = new GeminiFilesClient({ apiKey: "secret-key", fetchImpl });

    await expect(client.uploadFile("payload")).resolves.toEqual({
      name: "files/input",
    });
    expect(fetchImpl.calls).toHaveLength(2);
    expect(fetchImpl.calls[0]?.init?.redirect).toBe("error");
    expect(fetchImpl.calls[1]?.init?.redirect).toBe("error");
    expect(fetchImpl.calls[1]?.url).toBe(
      "https://generativelanguage.googleapis.com/upload/session",
    );
    expect(
      (fetchImpl.calls[1]?.init?.headers as Record<string, string>)[
        "x-goog-api-key"
      ],
    ).toBe("secret-key");
  });

  it("propagates caller cancellation across both resumable upload stages", async () => {
    const controller = new AbortController();
    const reason = new Error("caller cancelled upload");
    let callCount = 0;
    const fetchImpl = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        controller.abort(reason);
        return new Response("", {
          status: 200,
          headers: {
            "x-goog-upload-url":
              "https://generativelanguage.googleapis.com/upload/session",
          },
        });
      }
      return new Response(JSON.stringify({ file: { name: "files/input" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const client = new GeminiFilesClient({ apiKey: "secret-key", fetchImpl });

    await expect(
      client.uploadFile("payload", { signal: controller.signal }),
    ).rejects.toBe(reason);
  });

  it("aborts an in-flight upload-data request when the caller cancels", async () => {
    const controller = new AbortController();
    const reason = new Error("caller cancelled in-flight upload");
    let callCount = 0;
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      callCount += 1;
      if (callCount === 1) {
        return new Response("", {
          status: 200,
          headers: {
            "x-goog-upload-url":
              "https://generativelanguage.googleapis.com/upload/session",
          },
        });
      }
      const signal = init?.signal;
      controller.abort(reason);
      if (signal?.aborted) {
        throw signal.reason;
      }
      return new Response(JSON.stringify({ file: { name: "files/input" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const client = new GeminiFilesClient({ apiKey: "secret-key", fetchImpl });

    await expect(
      client.uploadFile("payload", { signal: controller.signal }),
    ).rejects.toBe(reason);
  });

  it("preserves caller cancellation when upload rejection settles after the timeout budget", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const reason = new Error("caller cancellation wins");
      let markUploadStarted!: () => void;
      const uploadStarted = new Promise<void>((resolve) => {
        markUploadStarted = resolve;
      });
      let callCount = 0;
      const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
        callCount += 1;
        if (callCount === 1) {
          return new Response("", {
            status: 200,
            headers: {
              "x-goog-upload-url":
                "https://generativelanguage.googleapis.com/upload/session",
            },
          });
        }
        const signal = init?.signal;
        if (!signal) throw new Error("missing upload abort signal");
        markUploadStarted();
        return await new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            setTimeout(() => reject(signal.reason), 100);
          }, { once: true });
        });
      }) as unknown as typeof fetch;
      const client = new GeminiFilesClient({
        apiKey: "secret-key",
        defaultTimeoutMs: 50,
        fetchImpl,
      });

      const upload = client.uploadFile("payload", { signal: controller.signal });
      const outcome = upload.then(
        () => null,
        (error: unknown) => error,
      );
      await uploadStarted;
      controller.abort(reason);
      await vi.advanceTimersByTimeAsync(150);

      expect(await outcome).toBe(reason);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies the configured timeout to the upload-data stage", async () => {
    vi.useFakeTimers();
    try {
      let callCount = 0;
      const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
        callCount += 1;
        if (callCount === 1) {
          return new Response("", {
            status: 200,
            headers: {
              "x-goog-upload-url":
                "https://generativelanguage.googleapis.com/upload/session",
            },
          });
        }
        const signal = init?.signal;
        if (!signal) {
          throw new Error("upload-data request is missing an abort signal");
        }
        return await new Promise<Response>((_resolve, reject) => {
          const rejectAbort = () => reject(signal.reason);
          if (signal.aborted) {
            rejectAbort();
          } else {
            signal.addEventListener("abort", rejectAbort, { once: true });
          }
        });
      }) as unknown as typeof fetch;
      const client = new GeminiFilesClient({
        apiKey: "secret-key",
        defaultTimeoutMs: 50,
        fetchImpl,
      });

      const rejection = expect(
        client.uploadFile("payload"),
      ).rejects.toMatchObject({
        code: ApiClientErrorCode.Timeout,
      });
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the upload timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    try {
      let callCount = 0;
      let bodySignal: AbortSignal | undefined;
      let markBodyStarted!: () => void;
      const bodyStarted = new Promise<void>((resolve) => {
        markBodyStarted = resolve;
      });
      const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
        callCount += 1;
        if (callCount === 1) {
          return new Response("", {
            status: 200,
            headers: {
              "x-goog-upload-url":
                "https://generativelanguage.googleapis.com/upload/session",
            },
          });
        }
        bodySignal = init?.signal ?? undefined;
        return {
          ok: true,
          json: async () => {
            markBodyStarted();
            return await new Promise<unknown>((_resolve, reject) => {
              bodySignal?.addEventListener("abort", () => {
                reject(bodySignal?.reason);
              }, { once: true });
            });
          },
        } as Response;
      }) as unknown as typeof fetch;
      const client = new GeminiFilesClient({
        apiKey: "secret-key",
        defaultTimeoutMs: 50,
        fetchImpl,
      });

      const upload = client.uploadFile("payload");
      const outcome = upload.then(
        () => null,
        (error: unknown) => error,
      );
      await bodyStarted;
      await vi.advanceTimersByTimeAsync(50);

      expect(bodySignal?.aborted).toBe(true);
      expect(await outcome).toMatchObject({
        code: ApiClientErrorCode.Timeout,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

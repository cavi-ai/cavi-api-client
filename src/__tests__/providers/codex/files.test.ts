import { describe, expect, it, vi } from "vitest";
import { CodexFilesClient } from "../../../providers/codex/files";

type Call = { url: string; init?: RequestInit };
function router(handler: (url: string, init?: RequestInit) => Response): typeof fetch & { calls: Call[] } {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as unknown as typeof fetch & { calls: Call[] };
  fn.calls = calls;
  return fn;
}

describe("CodexFilesClient", () => {
  it("uploads a multipart file with purpose + bearer auth", async () => {
    const fetchImpl = router((url) => {
      expect(url).toBe("https://api.openai.com/v1/files");
      return new Response(JSON.stringify({ id: "file-1", object: "file" }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const files = new CodexFilesClient({ apiKey: "sk", fetchImpl });
    const uploaded = await files.uploadFile('{"a":1}', "batch");

    const init = fetchImpl.calls[0]!.init!;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("purpose")).toBe("batch");
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(uploaded.id).toBe("file-1");
  });

  it("downloads file content as text", async () => {
    const files = new CodexFilesClient({
      apiKey: "sk",
      fetchImpl: router((url) => {
        expect(url).toBe("https://api.openai.com/v1/files/file-1/content");
        return new Response('{"line":1}\n', { status: 200 });
      }),
    });
    expect(await files.downloadFileContent("file-1")).toBe('{"line":1}\n');
  });

  it("retrieve + delete hit the right path/method", async () => {
    const fetchImpl = router((url, init) => {
      if (init?.method === "DELETE") return new Response(JSON.stringify({ id: "file-1", deleted: true }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ id: "file-1", bytes: 5 }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const files = new CodexFilesClient({ apiKey: "sk", fetchImpl });
    expect((await files.retrieveFile("file-1")).id).toBe("file-1");
    expect(await files.deleteFile("file-1")).toMatchObject({ deleted: true });
    expect(fetchImpl.calls.every((c) => c.url === "https://api.openai.com/v1/files/file-1")).toBe(true);
  });

  it("throws when no api key", () => {
    expect(() => new CodexFilesClient({ apiKey: "" })).toThrow(/api key is required/);
  });
});

import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client.js";

const deletions = [
  { name: "environment", run: (client: ClaudeManagedAgentClient) => client.deleteEnvironment("environment-1") },
  { name: "session", run: (client: ClaudeManagedAgentClient) => client.deleteSession("session-1") },
  { name: "resource", run: (client: ClaudeManagedAgentClient) => client.deleteResource("session-1", "resource-1") },
  { name: "memory store", run: (client: ClaudeManagedAgentClient) => client.deleteMemoryStore("store-1") },
  { name: "memory", run: (client: ClaudeManagedAgentClient) => client.deleteMemory("store-1", "memory-1") },
  { name: "vault", run: (client: ClaudeManagedAgentClient) => client.deleteVault("vault-1") },
  { name: "credential", run: (client: ClaudeManagedAgentClient) => client.deleteCredential("vault-1", "credential-1") },
];

describe("Managed Agents deletion response lifetimes through native fetch", () => {
  it.each(deletions)("releases an unread successful $name response body", async ({ run }) => {
    let disconnected!: () => void;
    const responseClosed = new Promise<string>((resolve) => { disconnected = () => resolve("closed"); });
    const methods: Array<string | undefined> = [];
    const server = createServer((request, response) => {
      request.resume();
      methods.push(request.method);
      response.once("close", disconnected);
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("deleted");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    let timer!: ReturnType<typeof setTimeout>;
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const client = new ClaudeManagedAgentClient({
        baseUrl: `http://127.0.0.1:${address.port}`, apiKey: "test-key",
      });
      await expect(run(client)).resolves.toBeUndefined();
      expect(methods).toEqual(["DELETE"]);
      expect(await Promise.race([
        responseClosed,
        new Promise<string>((resolve) => { timer = setTimeout(() => resolve("body still open"), 500); }),
      ])).toBe("closed");
    } finally {
      clearTimeout(timer);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("Managed Agents deletion acknowledgement compatibility", () => {
  it("accepts a bodyless 204 response", async () => {
    const client = new ClaudeManagedAgentClient({
      apiKey: "test-key", fetchImpl: async () => new Response(null, { status: 204 }),
    });
    await expect(client.deleteEnvironment("environment-1")).resolves.toBeUndefined();
  });

  it("preserves success when body disposal rejects", async () => {
    const client = new ClaudeManagedAgentClient({
      apiKey: "test-key",
      fetchImpl: async () => new Response(new ReadableStream({
        cancel() { throw new Error("Body disposal failed"); },
      }), { status: 200 }),
    });
    await expect(client.deleteEnvironment("environment-1")).resolves.toBeUndefined();
  });
});

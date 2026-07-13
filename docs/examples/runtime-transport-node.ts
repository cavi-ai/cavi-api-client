import {
  createJsonRpcTransport,
  createFramedMessageChannel,
  jsonLinesCodec,
} from "@cavi-ai/api-client/core/transport";
import {
  createStdioTransport,
  createUnixSocketTransport,
} from "@cavi-ai/api-client/core/transport/node";

const stdio = createStdioTransport({
  command: "runtime-server",
  args: ["--stdio"],
  stderr: "inherit",
});
const stdioRpc = createJsonRpcTransport({
  channel: createFramedMessageChannel(stdio, jsonLinesCodec()),
});
await stdioRpc.request("runtime.status");
await stdioRpc.close();

const socket = createUnixSocketTransport({
  path: "/tmp/runtime.sock",
  reconnect: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1_000 },
});
await socket.ready;
const socketRpc = createJsonRpcTransport({
  channel: createFramedMessageChannel(socket, jsonLinesCodec()),
});
await socketRpc.notify("runtime.wake");
await socketRpc.close();

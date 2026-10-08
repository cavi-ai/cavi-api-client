import { createFramedMessageChannel, type TransportFrameCodec } from "@cavi-ai/api-client/core/transport";
import { createStdioTransport } from "@cavi-ai/api-client/core/transport/node";

// Node only. The adapter chooses its process and matching framing codec.
export function openRuntimeProcess<T>(
  command: string,
  args: readonly string[],
  codec: TransportFrameCodec<T>,
  signal: AbortSignal,
) {
  const bytes = createStdioTransport({ command, args, signal });
  const channel = createFramedMessageChannel(bytes, codec);
  // Call channel.close() at owner shutdown; closed reports process termination.
  return { channel, closed: bytes.closed };
}

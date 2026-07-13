export interface TransportMessageChannel<T = unknown> {
  send(message: T, signal?: AbortSignal): Promise<void>;
  subscribe(listener: (message: T) => void): () => void;
  close(reason?: string): Promise<void>;
}

export interface TransportByteChannel {
  write(chunk: Uint8Array, signal?: AbortSignal): Promise<void>;
  subscribe(listener: (chunk: Uint8Array) => void): () => void;
  close(): Promise<void>;
}

export interface TransportFrameDecoder<T> {
  push(chunk: Uint8Array): readonly T[];
  finish(): readonly T[];
}

export interface TransportFrameCodec<T> {
  encode(value: T): Uint8Array;
  createDecoder(): TransportFrameDecoder<T>;
}

export function createFramedMessageChannel<T>(
  bytes: TransportByteChannel,
  codec: TransportFrameCodec<T>,
): TransportMessageChannel<T> {
  const decoder = codec.createDecoder();
  const listeners = new Set<(message: T) => void>();
  const unsubscribe = bytes.subscribe((chunk) => {
    for (const message of decoder.push(chunk)) {
      for (const listener of listeners) listener(message);
    }
  });
  let closed = false;

  return {
    send: (message, signal) => bytes.write(codec.encode(message), signal),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      if (closed) return;
      closed = true;
      unsubscribe();
      for (const message of decoder.finish()) {
        for (const listener of listeners) listener(message);
      }
      listeners.clear();
      await bytes.close();
    },
  };
}

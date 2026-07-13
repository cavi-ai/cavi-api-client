export interface TransportMessageChannel<T = unknown> {
  send(message: T, signal?: AbortSignal): Promise<void>;
  subscribe(listener: (message: T) => void): () => void;
  /** Invokes once on local or remote close, immediately when already closed. */
  subscribeClose(listener: (error?: unknown) => void): () => void;
  close(reason?: string): Promise<void>;
}

export interface TransportByteChannel {
  write(chunk: Uint8Array, signal?: AbortSignal): Promise<void>;
  subscribe(listener: (chunk: Uint8Array) => void): () => void;
  /** Invokes once on local or remote close, immediately when already closed. */
  subscribeClose(listener: (error?: unknown) => void): () => void;
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
  const unsubscribeMessages = bytes.subscribe((chunk) => {
    for (const message of decoder.push(chunk)) {
      for (const listener of listeners) listener(message);
    }
  });
  const closeListeners = new Set<(error?: unknown) => void>();
  let closed = false;
  let closedError: unknown;
  let unsubscribeClose = () => {};

  const notifyClosed = (error?: unknown) => {
    if (closed) return;
    closed = true;
    closedError = error;
    unsubscribeMessages();
    unsubscribeClose();
    let closeError = error;
    try {
      for (const message of decoder.finish()) {
        for (const listener of listeners) listener(message);
      }
    } catch (decoderError) {
      closeError = decoderError;
    }
    listeners.clear();
    for (const listener of closeListeners) listener(closeError);
    closeListeners.clear();
  };
  unsubscribeClose = bytes.subscribeClose(notifyClosed);
  if (closed) unsubscribeClose();

  return {
    send: (message, signal) => bytes.write(codec.encode(message), signal),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeClose(listener) {
      if (closed) {
        listener(closedError);
        return () => {};
      }
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    async close() {
      if (closed) return;
      try {
        await bytes.close();
        notifyClosed();
      } catch (error) {
        notifyClosed(error);
        throw error;
      }
    },
  };
}
